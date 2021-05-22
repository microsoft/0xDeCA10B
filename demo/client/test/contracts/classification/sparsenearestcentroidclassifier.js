const { convertNum } = require('../../../src/float-utils-node')
const { deploySparseNearestCentroidClassifier } = require('../../../src/ml-models/deploy-model-node')
const { assertCloseToNumbers, assertEqualNumbers } = require('../../float-test-utils-node')

contract('SparseNearestCentroidClassifier', function (accounts) {
	const toFloat = 1E9
	let classifier

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
		try {
			return bn.toNumber() / toFloat
		} catch (err) {
			console.error("Error converting %s", bn)
			throw err
		}
	}

	before("deploy classifier", async function () {
		const model = {
			intents: {
				ALARM: {
					centroid: { 0: +1 },
					dataCount: 2,
				},
				WEATHER: {
					centroid: { 1: +1 },
					dataCount: 2
				}
			}
		}
		classifier = (await deploySparseNearestCentroidClassifier(model, web3, { toFloat })).classifierContract
	})

	it("...should get the classifications", function () {
		const expectedClassifications = ["ALARM", "WEATHER"]
		return classifier.getNumClassifications().then(parseBN).then(numClassifications => {
			assert.equal(numClassifications, expectedClassifications.length, "Number of classifications is wrong")
			let promises = expectedClassifications.map((_, i) => {
				return classifier.classifications(i)
			})
			return Promise.all(promises).then(results => {
				assert.deepEqual(results, expectedClassifications, "Wrong classifications")
			})
		})
	})

	it("...should get the squared magnitudes", async function () {
		const squaredMagnitude0 = await classifier.getSquaredMagnitude(0)
		let expected = web3.utils.toBN(toFloat).mul(web3.utils.toBN(toFloat))
		assert(squaredMagnitude0.eq(expected), `${squaredMagnitude0} != ${expected}`);

		const squaredMagnitude1 = await classifier.getSquaredMagnitude(1)
		expected = web3.utils.toBN(toFloat).mul(web3.utils.toBN(toFloat))
		assert(squaredMagnitude1.eq(expected), `${squaredMagnitude1} != ${expected}`);
	})

	it("...should predict the classification", async function () {
		const data = [0]
		const prediction = await classifier.predict(data)
		assert.equal(prediction, 0, "Wrong classification")
	})

	it("...should predict the classification", async function () {
		const data = [1]
		const prediction = await classifier.predict(data)
		assert.equal(prediction, 1, "Wrong classification")
	})

	it("...should train", async function () {
		const data = [1, 2]
		const classification = 1

		const numDimensions = 3
		const promises = []
		for (let dimension = 0; dimension < numDimensions; ++dimension) {
			promises.push(classifier.getCentroidValue(classification, dimension).then(parseFloatBN))
		}
		const originalCentroidValues = await Promise.all(promises)
		const originalSquaredMagnitude = originalCentroidValues.reduce((prev, current) => {
			return prev + current * current
		}, 0)
		assertEqualNumbers(await classifier.getSquaredMagnitude(classification), web3.utils.toBN(originalSquaredMagnitude).mul(web3.utils.toBN(toFloat)).mul(web3.utils.toBN(toFloat)), web3, "original squared magnitude")

		let expectedUpdatedSquaredMagnitude = 0
		const originalDataCount = await classifier.getNumSamples(classification).then(parseBN)
		await classifier.update(data, classification)
		return classifier.getNumSamples(classification).then(parseBN).then(async dataCount => {
			assert.equal(dataCount, originalDataCount + 1, "Wrong data count.")
			for (let dimension = 0; dimension < numDimensions; ++dimension) {
				const v = await classifier.getCentroidValue(classification, dimension).then(parseFloatBN)
				expectedUpdatedSquaredMagnitude += v * v
				const update = data.indexOf(dimension) >= 0 ? 1 : 0
				assert.closeTo(v, (originalCentroidValues[dimension] * originalDataCount + update) / dataCount, 1 / toFloat,
					`value for centroid[${dimension}]`)
			}
			const updatedSquaredMagnitude = await classifier.getSquaredMagnitude(classification)
			assertCloseToNumbers(updatedSquaredMagnitude, expectedUpdatedSquaredMagnitude * toFloat * toFloat, toFloat, web3, "updated squared magnitude")
		})
	})

	it("...should train with updating non-zero centroid value", async function () {
		const data = [1, 2]
		const classification = 0
		const numDimensions = 3

		const promises = []
		for (let dimension = 0; dimension < numDimensions; ++dimension) {
			promises.push(classifier.getCentroidValue(classification, dimension).then(parseFloatBN))
		}
		const originalCentroidValues = await Promise.all(promises)
		const originalSquaredMagnitude = originalCentroidValues.reduce((prev, current) => {
			return prev + current * current
		}, 0)
		assertEqualNumbers(await classifier.getSquaredMagnitude(classification), web3.utils.toBN(originalSquaredMagnitude).mul(web3.utils.toBN(toFloat)).mul(web3.utils.toBN(toFloat)), web3, "original squared magnitude")

		const originalDataCount = await classifier.getNumSamples(classification).then(parseBN)
		await classifier.update(data, classification)
		let expectedUpdatedSquaredMagnitude = 0
		return classifier.getNumSamples(classification).then(parseBN).then(async dataCount => {
			assert.equal(dataCount, originalDataCount + 1, "Wrong data count.")
			for (let dimension = 0; dimension < numDimensions; ++dimension) {
				const v = await classifier.getCentroidValue(classification, dimension).then(parseFloatBN)
				expectedUpdatedSquaredMagnitude += v * v
				const update = data.indexOf(dimension) >= 0 ? 1 : 0
				assert.closeTo(v, (originalCentroidValues[dimension] * originalDataCount + update) / dataCount, 1 / toFloat,
					`value for centroid[${dimension}]`)
			}
			assertCloseToNumbers(await classifier.getSquaredMagnitude(classification), expectedUpdatedSquaredMagnitude * toFloat * toFloat, toFloat, web3, "updated squared magnitude")
		})
	})

	it("...should train with new feature", async function () {
		const data = [4]
		const classification = 1
		const numDimensions = 5

		const promises = []
		for (let dimension = 0; dimension < numDimensions; ++dimension) {
			promises.push(classifier.getCentroidValue(classification, dimension).then(parseFloatBN))
		}
		const originalCentroidValues = await Promise.all(promises)
		const originalSquaredMagnitude = originalCentroidValues.reduce((prev, current) => {
			return prev + current * current
		}, 0)
		assertCloseToNumbers(await classifier.getSquaredMagnitude(classification), web3.utils.toBN(originalSquaredMagnitude * toFloat * toFloat),
			toFloat, web3, "original squared magnitude")

		const originalDataCount = await classifier.getNumSamples(classification).then(parseBN)
		await classifier.update(data, classification)
		let expectedUpdatedSquaredMagnitude = 0
		return classifier.getNumSamples(classification).then(parseBN).then(async dataCount => {
			assert.equal(dataCount, originalDataCount + 1, "Wrong data count.")
			for (let dimension = 0; dimension < numDimensions; ++dimension) {
				const v = await classifier.getCentroidValue(classification, dimension).then(parseFloatBN)
				expectedUpdatedSquaredMagnitude += v * v
				const update = data.indexOf(dimension) >= 0 ? 1 : 0
				assert.closeTo(v, (originalCentroidValues[dimension] * originalDataCount + update) / dataCount, 1 / toFloat,
					`value for centroid[${dimension}]`)
			}
			assertCloseToNumbers(await classifier.getSquaredMagnitude(classification), expectedUpdatedSquaredMagnitude * toFloat * toFloat, toFloat, web3, "updated squared magnitude")
		})
	})

	it("...should add class", async function () {
		const centroid = [[0, 0], [1, 0], [2, +1]]
		const newClassificationName = "NEW"
		const dataCount = 2

		const originalNumClassifications = await classifier.getNumClassifications().then(parseBN)
		const info = await classifier.addClass(centroid.map(f => [f[0], convertNum(f[1], web3, toFloat)]), newClassificationName, dataCount)
		const events = info.logs.filter(l => l.event == 'AddClass')
		assert.lengthOf(events, 1)
		const event = events[0]
		assert.equal(event.args.name, newClassificationName)
		const newClassificationIndex = parseBN(event.args.index)
		assert.equal(newClassificationIndex, originalNumClassifications)
		const newNumClassifications = await classifier.getNumClassifications().then(parseBN)
		assert.equal(newNumClassifications, originalNumClassifications + 1)
		const className = await classifier.classifications(newClassificationIndex)
		assert.equal(className, newClassificationName)
		const foundDataCount = await classifier.getNumSamples(newClassificationIndex).then(parseBN)
		assert.equal(foundDataCount, dataCount)
	})

	it("...should extend centroid", async function () {
		const classification = 0
		const extension = [[5, 1.5], [7, 2.5]]
		const originalCentroidValues = await Promise.all([...Array(3).keys()].map(dimension => {
			return classifier.getCentroidValue(classification, dimension).then(parseFloatBN)
		}))
		const expectedCentroidValues = Array.prototype.concat(originalCentroidValues, [0, 0, 1.5, 0, 2.5])
		await classifier.extendCentroid(extension.map(f => [f[0], convertNum(f[1], web3, toFloat)]), classification)

		for (let dimension = 0; dimension < expectedCentroidValues.length; ++dimension) {
			const v = await classifier.getCentroidValue(classification, dimension).then(parseFloatBN)
			assert.closeTo(v, expectedCentroidValues[dimension], 1 / toFloat, `value for centroid[${dimension}]`)
		}
	})
})
