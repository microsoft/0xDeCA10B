const NearestCentroidClassifier = artifacts.require("./classification/NearestCentroidClassifier")

const { convertData } = require('../../../src/float-utils-node')

contract('NearestCentroidClassifier', function (accounts) {
	const toFloat = 1E9
	let classifier

	function normalize(data) {
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

	before("deploy classifier", function () {
		const classifications = ["ALARM", "WEATHER"]
		const centroids = [
			convertData([-1, -1], web3, toFloat),
			convertData([+1, +1], web3, toFloat),
		]
		const dataCounts = [2, 2]
		return NearestCentroidClassifier.new(classifications, centroids, dataCounts).then(c => {
			classifier = c
		})
	})

	it("...should get the classifications", function () {
		const expectedClassifications = ["ALARM", "WEATHER"]
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

	it("...should predict the classification", function () {
		const data = [-1.5, -0.5]
		return normalize(data).then(data => {
			return classifier.predict(data).then((prediction) => {
				assert.equal(prediction, 0, "Wrong classification.")
			})
		})
	})

	it("...should predict the classification", function () {
		const data = [+0.5, +1.5]
		return normalize(data).then(data => {
			return classifier.predict(data).then((prediction) => {
				assert.equal(prediction, 1, "Wrong classification.")
			})
		})
	})

	it("...should train", function () {
		const data = [+4, +4]
		const classification = 1
		return normalize(data).then(normalizedData => {
			const promises = data.map((_, dimension) => {
				return classifier.centroids(classification, dimension).then(parseFloatBN)
			})
			return Promise.all(promises).then(originalCentroidValues => {
				return classifier.dataCounts(classification).then(parseBN).then(originalDataCount => {
					return classifier.update(normalizedData, classification).then(() => {
						return classifier.dataCounts(classification).then(parseBN).then(dataCount => {
							assert.equal(dataCount, originalDataCount + 1, "Wrong data count.")
							const promises = normalizedData.map((dataVal, dimension) => {
								return classifier.centroids(classification, dimension).then(parseFloatBN).then(v => {
									assert.equal(v, (originalCentroidValues[dimension] * originalDataCount + parseFloatBN(dataVal)) / dataCount,
										`value for centroid[${dimension}]`)
								})
							})
							return Promise.all(promises)
						})
					})
				})
			})
		})
	})

	it("...should train negative numbers", function () {
		const data = [-4, -4]
		const classification = 0
		return normalize(data).then(normalizedData => {
			const promises = data.map((_, dimension) => {
				return classifier.centroids(classification, dimension).then(parseFloatBN)
			})
			return Promise.all(promises).then(originalCentroidValues => {
				return classifier.dataCounts(classification).then(parseBN).then(originalDataCount => {
					return classifier.update(normalizedData, classification).then(() => {
						return classifier.dataCounts(classification).then(parseBN).then(dataCount => {
							assert.equal(dataCount, originalDataCount + 1, "Wrong data count.")
							const promises = normalizedData.map((dataVal, dimension) => {
								return classifier.centroids(classification, dimension).then(parseFloatBN).then(v => {
									assert.equal(v, (originalCentroidValues[dimension] * originalDataCount + parseFloatBN(dataVal)) / dataCount)
								})
							})
							return Promise.all(promises)
						})
					})
				})
			})
		})
	})

	it("...should add class", function () {
		const centroid = [-1, +1]
		const newClassificationName = "NEW"
		const dataCount = 2

		return classifier.getNumClassifications().then(parseBN).then(originalNumClassifications => {
			return classifier.addClass(convertData(centroid, web3, toFloat), newClassificationName, dataCount).then(info => {
				const events = info.logs.filter(l => l.event == 'AddClass')
				assert.lengthOf(events, 1)
				const event = events[0]
				assert.equal(event.args.name, newClassificationName)
				const newClassificationIndex = parseBN(event.args.index)
				assert.equal(newClassificationIndex, originalNumClassifications)
				return classifier.getNumClassifications().then(parseBN).then(newNumClassifications => {
					assert.equal(newNumClassifications, originalNumClassifications + 1)
					return classifier.classifications(newClassificationIndex).then(className => {
						assert.equal(className, newClassificationName)
						return classifier.dataCounts(newClassificationIndex).then(parseBN).then(foundDataCount => {
							assert.equal(foundDataCount, dataCount)
						})
					})
				})
			})
		})
	})

	it("...should extend centroids", async function () {
		const classification = 0
		const extension = [2, 2]
		const originalCentroidValues = await Promise.all([...Array(2).keys()].map(dimension => {
			return classifier.centroids(classification, dimension).then(parseFloatBN)
		}))
		const expectedCentroidValues = Array.prototype.concat(originalCentroidValues, extension)
		await classifier.extendCentroid(convertData(extension, web3, toFloat), classification)

		for (let dimension = 0; dimension < expectedCentroidValues.length; ++dimension) {
			const v = await classifier.centroids(classification, dimension).then(parseFloatBN)
			assert.closeTo(v, expectedCentroidValues[dimension], 1 / toFloat, `value for centroid[${dimension}]`)
		}
	})
})
