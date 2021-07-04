import Web3 from 'web3'
import { Contract } from 'web3-eth-contract'
import Classifier from './compiled/Classifier64.json'
import CollaborativeTrainer64 from './compiled/CollaborativeTrainer64.json'
import DataHandler from './compiled/DataHandler64.json'
import IncentiveMechanism from './compiled/IncentiveMechanism64.json'

/**
 * An already deployed instance of a CollaborativeTrainer contract.
 */
export class CollaborativeTrainer {
	constructor(
		public mainEntryPoint: Contract,
		public classifier: Contract,
		public dataHandler: Contract,
		public incentiveMechanism: Contract,
	) {
	}

	/**
	 * @returns The name of the model.
	 */
	name(): Promise<string> {
		return this.mainEntryPoint.methods.name().call()
	}

	/**
	 * @returns A description of the model.
	 */
	description(): Promise<string> {
		return this.mainEntryPoint.methods.description().call()
	}

	/**
	 * @returns The name of the encoder used by the model.
	 */
	encoder(): Promise<string> {
		return this.mainEntryPoint.methods.encoder().call()
	}

	/**
	 * @param data Encoded data.
	 * Already transformed data by operations such as encoding, normalization, and `web3.utils.toHex`.
	 * @returns The model's prediction for `data`.
	 */
	predictEncoded(data: Array<string>): Promise<number> {
		return this.classifier.methods.predict(data).call().then(parseInt)
	}
}

/**
 * Help validate if a contract can be used with the system.
 */
export class ContractLoader {
	web3: Web3

	constructor(web3: Web3) {
		this.web3 = web3
	}

	getContractInstance(options: { abi: any, address: string }): Contract {
		return new this.web3.eth.Contract(options.abi, options.address)
	}

	/**
	 * Loads and validates the contracts.
	 * @param address The address of the main entry point contract.
	 * @returns An interface to help you use the contracts.
	 */
	async load(address: string): Promise<CollaborativeTrainer> {
		if (!address || address.length === 0) {
			return Promise.reject("A blank address was given")
		}

		const mainEntryPoint = this.getContractInstance({
			abi: CollaborativeTrainer64.abi,
			address,
		})
		return Promise.all([
			mainEntryPoint.methods.classifier().call().then((classifierAddress: string) => {
				return this.getContractInstance({
					abi: Classifier.abi,
					address: classifierAddress
				})
			}),
			mainEntryPoint.methods.dataHandler().call().then((dataHandlerAddress: string) => {
				return this.getContractInstance({
					abi: DataHandler.abi,
					address: dataHandlerAddress
				})
			}),
			mainEntryPoint.methods.incentiveMechanism().call().then((incentiveMechanismAddress: string) => {
				return this.getContractInstance({
					abi: IncentiveMechanism.abi,
					address: incentiveMechanismAddress
				})
			})
		]).then(async ([
			classifier,
			dataHandler,
			incentiveMechanism,
		]) => {
			const [classifierOwner, dataHandlerOwner, incentiveMechanismOwner] = await Promise.all([
				classifier.methods.owner().call(),
				dataHandler.methods.owner().call(),
				incentiveMechanism.methods.owner().call(),
			])
			if (classifierOwner !== address || dataHandlerOwner !== address || incentiveMechanismOwner !== address) {
				throw new Error(`The classifer, data handler, and incentive mechanism must be owned by the main interface.\n  Main interface address: ${address}\n  Classifier owner: ${classifierOwner}\n  Data handler owner: ${dataHandlerOwner}\n  IM owner: ${incentiveMechanismOwner}.`)
			}

			return new CollaborativeTrainer(mainEntryPoint,
				classifier, dataHandler, incentiveMechanism)
		})
	}
}
