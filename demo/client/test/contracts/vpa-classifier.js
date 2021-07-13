const fs = require('fs')

const CollaborativeTrainer64 = artifacts.require("./CollaborativeTrainer64")
const DataHandler64 = artifacts.require("./data/DataHandler64")
const NearestCentroidClassifier = artifacts.require("./classification/NearestCentroidClassifier")
const Stakeable64 = artifacts.require("./incentive/Stakeable64")

const { convertData } = require('../../src/float-utils-node')

/**
 * This test was mainly created to test gas usage.
 */
contract('VpaClassifier', function (accounts) {
	let numDimensions = null
	const toFloat = 1E9
	let dataHandler, incentiveMechanism, classifier, instance

	async function normalize(data) {
		data = convertData(data, web3, toFloat)
		return classifier.norm(data).then(norm => {
			return data.map(x => x.mul(web3.utils.toBN(toFloat)).div(norm))
		})
	}

	function parseBN(num) {
		if (web3.utils.isBN(num)) {
			return num.toNumber()
		} else {
			assert.typeOf(num, 'number')
			return num
		}
	}

	function parseFloatBN(bn) {
		assert(web3.utils.isBN(bn), `${bn} is not a BN`)
		// Can't divide first since a BN can only be an integer.
		return bn.toNumber() / toFloat
	}

	before("deploy contracts", async () => {
		console.log(`Deploying VPA classifier for tests.`)
		// Low default times for testing.
		const refundTimeS = 15
		const ownerClaimWaitTimeS = 20
		const anyAddressClaimWaitTimeS = 20
		// Weight for deposit cost in wei.
		const costWeight = 1E15

		// Model
		const classifications = []
		const centroids = []
		const dataCounts = []
		let model = fs.readFileSync('./src/ml-models/vpa/vpa-classifier-centroids.json', 'utf8')
		model = JSON.parse(model)
		for (let [classification, centroidInfo] of Object.entries(model.intents)) {
			classifications.push(classification)
			// To test gas usage faster, use less dimensions:
			// centroidInfo.centroid = centroidInfo.centroid.slice(0, 64);
			centroids.push(convertData(centroidInfo.centroid, web3, toFloat))
			dataCounts.push(centroidInfo.dataCount)
			if (numDimensions === null) {
				numDimensions = centroidInfo.centroid.length
			} else {
				assert.equal(centroidInfo.centroid.length, numDimensions)
			}
		}

		console.log(`  Deploying DataHandler.`)
		dataHandler = await DataHandler64.new()
		console.log(`  Deployed data handler to ${dataHandler.address}.`)
		incentiveMechanism = await Stakeable64.new(
			refundTimeS,
			ownerClaimWaitTimeS,
			anyAddressClaimWaitTimeS,
			costWeight
		)
		console.log(`  Deployed incentive mechanism to ${incentiveMechanism.address}.`)
		classifier = await NearestCentroidClassifier.new(
			[classifications[0]], [centroids[0]], [dataCounts[0]],
			// Block gasLimit by most miners as of May 2019.
			{ gas: 8.9E6 }
		)
		console.log(`  Deployed classifier to ${classifier.address}.`)
		// Add classes separately to avoid hitting gasLimit.
		const addClassPromises = []
		for (let i = 1; i < classifications.length; ++i) {
			addClassPromises.push(classifier.addClass(
				centroids[i], classifications[i], dataCounts[i]
			))
		}
		console.log(`  Deploying main entry point.`)
		instance = await CollaborativeTrainer64.new(
			"name", "description", "encoder",
			dataHandler.address,
			incentiveMechanism.address,
			classifier.address
		)
		console.log(`  Deployed VPA collaborative classifier to ${instance.address}.`)
		return Promise.all([
			dataHandler.transferOwnership(instance.address),
			incentiveMechanism.transferOwnership(instance.address),
			classifier.transferOwnership(instance.address),
		].concat(addClassPromises)).then(() => {
			console.log("  All classes added.")
		})
	})


	it("...should get the classifications", async function () {
		const expectedClassifications = ["WEATHER_GET", "MUSIC_PLAY"]
		return classifier.getNumClassifications().then(parseBN).then(numClassifications => {
			assert.equal(numClassifications, expectedClassifications.length, "Number of classifications is wrong.")
			let promises = expectedClassifications.map((_, i) => {
				return classifier.classifications(i)
			})
			return Promise.all(promises).then(results => {
				assert.deepEqual(results, expectedClassifications, "Wrong classifications.")
			})
		})
	})

	it("...should add data", async () => {
		const cost = await instance.incentiveMechanism()
			.then(Stakeable64.at)
			.then(inc => inc.getNextAddDataCost())
		assert(cost.gtn(0), "Cost should be positive.")
		// To test random data use:
		// const data = Array.from({length: numDimensions}).map(Math.random);

		// Test consistent data:
		const data = []
		for (let i = 0; i < numDimensions; ++i) {
			data.push((i + 222) / 1100)
		}
		const normalizedData = await normalize(data)
		const classification = 0
		const centroidPromises = data.map((_, dimension) => {
			return classifier.centroids(classification, dimension).then(parseFloatBN)
		})
		const originalCentroidValues = await Promise.all(centroidPromises)

		const originalDataCount = await classifier.dataCounts(classification).then(parseBN)

		const r = await instance.addData(normalizedData, classification, { from: accounts[0], value: cost })
		assert.isBelow(r.receipt.gasUsed, 7.9E6, "Too much gas used.")
		assert.isBelow(r.receipt.cumulativeGasUsed, 7.9E6, "Too much gas used.")

		const dataCount = await classifier.dataCounts(classification).then(parseBN)
		assert.equal(dataCount, originalDataCount + 1, "Wrong data count.")
		// Don't need to check every dimension so save time by just checking a few.
		const numDimensionsToCheck = 20
		const promises = normalizedData.slice(0, numDimensionsToCheck).map((dataVal, dimension) => {
			return classifier.centroids(classification, dimension).then(parseFloatBN).then(v => {
				assert.closeTo(v,
					(originalCentroidValues[dimension] * originalDataCount + parseFloatBN(dataVal)) / dataCount,
					1E-8)
			})
		})
		return Promise.all(promises)
	})
})
