import assert from 'assert'
import Web3 from 'web3'
import { convertNum } from '../../float-utils'
import { CentroidInfo, ModelDeployer, NearestCentroidModel } from '../deploy-model'

declare const web3: Web3

function assertEqualNumbers(actual: any, expected: any, message?: string | Error): void {
	if (web3.utils.isBN(actual)) {
		if (web3.utils.isBN(expected)) {
			if (message === undefined) {
				message = `actual: ${actual} (${typeof actual})\nexpected: ${expected} (${typeof expected})`
			}
			return assert(actual.eq(expected), message)
		} else {
			const expectedBN = web3.utils.toBN(expected)
			if (message === undefined) {
				message = `actual: ${actual} (${typeof actual})\nexpected: ${expected} (${typeof expected}) => BN: ${expectedBN}`
			}
			return assert(actual.eq(expectedBN), message)
		}
	} else if (web3.utils.isBN(expected)) {
		const actualBN = web3.utils.toBN(actual)
		if (message === undefined) {
			message = `actual: ${actual} (${typeof actual}) => BN: ${actualBN}\nexpected: ${expected} (${typeof expected})`
		}
		return assert(actualBN.eq(expected), message)
	} else {
		if (typeof actual === 'string') {
			actual = parseInt(actual)
		}
		return assert.equal(actual, expected, message)
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

	it("should deploy dense Nearest Centroid", async () => {
		const model = new NearestCentroidModel(
			'dense nearest centroid classifier',
			{
				"AA": new CentroidInfo([-1, -1], 2),
				"BB": new CentroidInfo([+1, +1], 2),
			}
		)
		const m = await deployer.deployModel(
			model,
			{
				account,
				notify: console.log,
			})

		let i = -1
		for (let [classification, centroidInfo] of Object.entries(model.intents)) {
			++i
			assert.equal(await m.methods.classifications(i).call(), classification)
			assertEqualNumbers(await m.methods.getNumSamples(i).call(), centroidInfo.dataCount)
			for (let j = 0; j < centroidInfo.centroid.length; ++j) {
				assertEqualNumbers(await m.methods.getCentroidValue(i, j).call(), convertNum(centroidInfo.centroid[j], web3))
			}
		}
	})

	it("should deploy sparse Nearest Centroid", async () => {
		const model = new NearestCentroidModel(
			'sparse nearest centroid classifier',
			{
				"AA": new CentroidInfo([0, +1], 2),
				"BB": new CentroidInfo([+1, 0], 2),
			}
		)
		const m = await deployer.deployModel(
			model,
			{
				account,
				notify: console.log,
			})

		let i = -1
		for (let [classification, centroidInfo] of Object.entries(model.intents)) {
			++i
			assert.equal(await m.methods.classifications(i).call(), classification)
			assertEqualNumbers(await m.methods.getNumSamples(i).call(), centroidInfo.dataCount)
			for (let j = 0; j < centroidInfo.centroid.length; ++j) {
				assertEqualNumbers(await m.methods.getCentroidValue(i, j).call(), convertNum(centroidInfo.centroid[j], web3))
			}
		}
	})

	it("should deploy dense Perceptron", async () => {
		const classifications = ["A", "B"]
		const weights = [1, -1]
		const intercept = 0
		const m = await deployer.deployModel(
			{
				type: 'dense perceptron',
				classifications,
				weights,
				intercept,
			},
			{
				account,
			})

		for (let i = 0; i < classifications.length; ++i) {
			assert.equal(await m.methods.classifications(i).call(), classifications[i])
		}
		for (let i = 0; i < weights.length; ++i) {
			assertEqualNumbers(await m.methods.weights(i).call(), convertNum(weights[i], web3))
		}
		assertEqualNumbers(await m.methods.intercept().call(), convertNum(intercept, web3))
	})

	it("should deploy sparse Perceptron", async () => {
		const classifications = ["AA", "BB"]
		const weights = [2, -2]
		const intercept = 3
		const m = await deployer.deployModel(
			{
				type: 'sparse perceptron',
				classifications,
				weights,
				intercept,
			},
			{
				account,
				// notify: console.log,
			})

		for (let i = 0; i < classifications.length; ++i) {
			assert.equal(await m.methods.classifications(i).call(), classifications[i])
		}
		for (let i = 0; i < weights.length; ++i) {
			assertEqualNumbers(await m.methods.weights(i).call(), convertNum(weights[i], web3))
		}
		assertEqualNumbers(await m.methods.intercept().call(), convertNum(intercept, web3))
	})
})
