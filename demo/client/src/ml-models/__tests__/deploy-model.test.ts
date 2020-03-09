import assert from 'assert'
import Web3 from 'web3'
import { convertNum } from '../../float-utils'
import { ModelDeployer } from '../deploy-model'

declare const web3: Web3

function assertEqualNumbers(actual: any, expected: any, message?: string | Error): void {
	let actualBN = actual
	if (!web3.utils.isBN(actual)) {
		actualBN = web3.utils.toBN(actual)
	}
	if (typeof message === undefined) {
		message = `actual: ${actual}\nexpected: ${expected}`
	}
	return assert(actualBN.eq(expected), message)
}

describe("ModelDeployer", () => {
	it("should deploy dense Perceptron", async () => {
		const accounts = await web3.eth.getAccounts()
		// Pick a random account between 2 and 9 since 0 and 1 are usually used in the browser.
		const account = accounts[2 + Math.floor(Math.random() * 8)]
		const deployer = new ModelDeployer(web3)

		const classifications = ["A", "B"]
		const weights = [1, -1]
		const intercept = 0
		const model = await deployer.deployModel(
			{
				type: 'dense perceptron',
				classifications,
				weights,
				intercept,
			},
			{
				account,
				// notify: console.log,
			})

		for (let i = 0; i < classifications.length; ++i) {
			assert.equal(await model.methods.classifications(i).call(), classifications[i])
		}
		for (let i = 0; i < weights.length; ++i) {
			assertEqualNumbers(await model.methods.weights(i).call(), convertNum(weights[i], web3))
		}
		assertEqualNumbers(await model.methods.intercept().call(), convertNum(intercept, web3))
	})
})
