import assert from 'assert'
import Web3 from 'web3'
import { convertNum } from '../../float-utils'
import { ModelDeployer } from '../deploy-model'
import { CentroidInfo, DensePerceptronModel, Model, NaiveBayesModel, NearestCentroidModel, SparseCentroidInfo, SparseNearestCentroidModel, SparsePerceptronModel } from '../model-interfaces'

declare const web3: Web3

function assertEqualNumbers(actual: any, expected: any, message?: string | Error): void {
	if (message) {
		message += "\n"
	}
	if (web3.utils.isBN(actual)) {
		if (web3.utils.isBN(expected)) {
			message = `${message || ""}actual: ${actual} (BN)\nexpected: ${expected} (BN)`
			return assert(actual.eq(expected), message)
		} else {
			const expectedBN = web3.utils.toBN(expected)
			message = `${message || ""}actual: ${actual} (BN)\nexpected: ${expected} (${typeof expected}) => BN: ${expectedBN}`
			return assert(actual.eq(expectedBN), message)
		}
	} else if (web3.utils.isBN(expected)) {
		const actualBN = web3.utils.toBN(actual)
		message = `${message || ""}actual: ${actual} (${typeof actual}) => BN: ${actualBN}\nexpected: ${expected} (BN)`
		return assert(actualBN.eq(expected), message)
	} else {
		if (typeof actual === 'string') {
			actual = parseInt(actual)
		}
		return assert.strictEqual(actual, expected, message)
	}
}

describe("ModelDeployer", () => {
	let account: string
	const deployer = new ModelDeployer(web3)

	beforeAll(async () => {
		const accounts = await web3.eth.getAccounts()
		// Pick a random account between 2 and 9 since 0 and 1 are usually used in the browser.
		account = accounts[2 + Math.min(Math.floor(Math.random() * 8), 7)]
	})

	it("should deploy Naive Bayes", async () => {
		const model = new NaiveBayesModel(
			'naive bayes',
			[
				"A",
				"B",
			],
			[
				2,
				3
			],
			[
				[[0, 2], [1, 1]],
				[[1, 3], [2, 2]],
			],
			9,
			1.0,
		)
		const m = await deployer.deployModel(
			model,
			{
				account,
			})

		assertEqualNumbers(await m.methods.smoothingFactor().call(), convertNum(model.smoothingFactor, web3), "smoothingFactor")
		for (let i = 0; i < model.classifications.length; ++i) {
			assert.strictEqual(await m.methods.classifications(i).call(), model.classifications[i])
			assertEqualNumbers(await m.methods.getNumSamples(i).call(), model.classCounts[i])
			for (const [featureIndex, count] of model.featureCounts[i]) {
				assertEqualNumbers(await m.methods.getFeatureCount(i, featureIndex).call(), count)
			}
		}
		assertEqualNumbers(await m.methods.getClassTotalFeatureCount(0).call(), 3)
		assertEqualNumbers(await m.methods.getClassTotalFeatureCount(1).call(), 5)
	})

	it("should deploy dense Nearest Centroid", async () => {
		const model = new NearestCentroidModel(
			'dense nearest centroid classifier',
			{
				"AA": new CentroidInfo([-1, -1, 4.88, -8.44, -3], 2),
				"BB": new CentroidInfo([+1, -1.8, 9.07, 3, -3], 2),
			}
		)
		const m = await deployer.deployModel(
			model,
			{
				account,
			})

		let i = -1
		for (let [classification, centroidInfo] of Object.entries(model.centroids)) {
			++i
			assert.strictEqual(await m.methods.classifications(i).call(), classification)
			assertEqualNumbers(await m.methods.getNumSamples(i).call(), centroidInfo.dataCount)
			for (let j = 0; j < centroidInfo.centroid.length; ++j) {
				const actual = await m.methods.getCentroidValue(i, j).call()
				assertEqualNumbers(actual, convertNum(centroidInfo.centroid[j], web3), `centroid value for class ${i}[${j}]`)
			}
		}
	})

	it("should deploy sparse Nearest Centroid", async () => {
		const model = new SparseNearestCentroidModel(
			'sparse nearest centroid classifier',
			{
				// Values should all be positive since the representation is sparse.
				"AA": new SparseCentroidInfo({ '0': 0, '1': +1, '7': 1.5, }, 2),
				"BB": new SparseCentroidInfo({ '0': +1, '1': 0, '5': 0.5 }, 2),
			}
		)
		const m = await deployer.deployModel(
			model,
			{
				account,
			})

		let i = -1
		for (let [classification, centroidInfo] of Object.entries(model.centroids)) {
			++i
			assert.strictEqual(await m.methods.classifications(i).call(), classification)
			assertEqualNumbers(await m.methods.getNumSamples(i).call(), centroidInfo.dataCount)
			for (const [featureIndex, value] of Object.entries(centroidInfo.centroid)) {
				assertEqualNumbers(await m.methods.getCentroidValue(i, featureIndex).call(), convertNum(value, web3), `centroid value for class ${i}[${featureIndex}]`)
			}
		}
	})

	it("should deploy sparse Nearest Centroid with array centroids", async () => {
		// This shouldn't happen but it could if a model gets exported from the Python code
		// and the type is set correctly.
		const model = {
			type: 'sparse nearest centroid classifier',
			centroids: {
				"AA": {
					centroid: [0, 1, 1.5, 2, 87.88],
					dataCount: 2
				},
				"BB": {
					centroid: [1, 0, 0.5, 3.787],
					dataCount: 2
				},
			}
		}
		const m = await deployer.deployModel(
			model as Model,
			{
				account,
			})

		let i = -1
		for (let [classification, centroidInfo] of Object.entries(model.centroids)) {
			++i
			assert.strictEqual(await m.methods.classifications(i).call(), classification)
			assertEqualNumbers(await m.methods.getNumSamples(i).call(), centroidInfo.dataCount)
			for (const [featureIndex, value] of Object.entries(centroidInfo.centroid)) {
				assertEqualNumbers(await m.methods.getCentroidValue(i, featureIndex).call(), convertNum(value, web3), `centroid value for class ${i}[${featureIndex}]`)
			}
		}
	})

	it("should deploy dense Perceptron", async () => {
		const classifications = ["A", "B"]
		const weights = [1, -1, 2.33, -8.66]
		const intercept = 0
		const m = await deployer.deployModel(
			new DensePerceptronModel(
				'dense perceptron',
				classifications,
				weights,
				intercept,
			),
			{
				account,
			})

		for (let i = 0; i < classifications.length; ++i) {
			assert.strictEqual(await m.methods.classifications(i).call(), classifications[i])
		}
		for (let i = 0; i < weights.length; ++i) {
			assertEqualNumbers(await m.methods.weights(i).call(), convertNum(weights[i], web3))
		}
		assertEqualNumbers(await m.methods.intercept().call(), convertNum(intercept, web3))
	})

	it("should deploy sparse Perceptron", async () => {
		const classifications = ["AA", "BB"]
		const weights = [2, -2, 2.44, -7.55, 0.537080412, 2000, -23232.32]
		const sparseWeights = null
		const intercept = 3
		const m = await deployer.deployModel(
			new SparsePerceptronModel(
				'sparse perceptron',
				classifications,
				weights, sparseWeights,
				intercept,
			),
			{
				account,
			})

		for (let i = 0; i < classifications.length; ++i) {
			assert.strictEqual(await m.methods.classifications(i).call(), classifications[i])
		}

		assertEqualNumbers(await m.methods.intercept().call(), convertNum(intercept, web3), "intercept:")

		assertEqualNumbers(await m.methods.learningRate().call(), convertNum(0.5, web3), "learningRate:")

		for (let i = 0; i < weights.length; ++i) {
			assertEqualNumbers(await m.methods.weights(i).call(), convertNum(weights[i], web3), `weight ${i}:`)
		}
	})

	it("should deploy sparse Perceptron - with sparseWeights", async () => {
		const classifications = ["AA", "BB"]
		const weights = [2, -2, 2.44, -7.55, -3]
		const sparseWeights = { '8': 7, '11': 8, '12': 8.21, '15': -4.55, '17': -3 }
		const intercept = 3
		const m = await deployer.deployModel(
			new SparsePerceptronModel(
				'sparse perceptron',
				classifications,
				weights, sparseWeights,
				intercept,
			),
			{
				account,
				// notify: console.debug,
			})

		for (let i = 0; i < classifications.length; ++i) {
			assert.strictEqual(await m.methods.classifications(i).call(), classifications[i])
		}

		assertEqualNumbers(await m.methods.intercept().call(), convertNum(intercept, web3), "intercept:")

		assertEqualNumbers(await m.methods.learningRate().call(), convertNum(0.5, web3), "learningRate:")

		for (let i = 0; i < weights.length; ++i) {
			const actual = await m.methods.weights(i).call()
			assertEqualNumbers(actual, convertNum(weights[i], web3), `weight ${i}:`)
		}

		for (const [featureIndexKey, weight] of Object.entries(sparseWeights)) {
			const featureIndex = parseInt(featureIndexKey, 10)
			const actual = await m.methods.weights(featureIndex).call()
			assertEqualNumbers(actual, convertNum(weight, web3), `sparseWeight ${featureIndex}:`)
		}
	})
})
