import Web3 from 'web3'
import { Contract } from 'web3-eth-contract'
import Classifier from './compiled/Classifier64.json'
import CollaborativeTrainer64 from './compiled/CollaborativeTrainer64.json'
import DataHandler from './compiled/DataHandler64.json'
import IncentiveMechanism from './compiled/IncentiveMechanism.json'

/**
 * The result of checking if a contract is valid.
 */
export class CollaborativeTrainer {
	constructor(
		public mainEntryPoint: Contract,
		public classifier: Contract,
		public dataHandler: Contract,
		public incentiveMechanism: Contract,
	) {
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

	getContractInstance(options: any): Contract {
		return new this.web3.eth.Contract(options.abi, options.address)
	}

	/**
	 * 
	 * @param address The address of the main entry point contract.
	 */
	async load(address: string): Promise<CollaborativeTrainer> {
		if (!address || address.length === 0) {
			return Promise.reject("A blank address was given")
		}

		// It is a valid address, so check the other interfaces.
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
		]).then(([
			classifier,
			dataHandler,
			incentiveMechanism,
		]) => {
			return new CollaborativeTrainer(mainEntryPoint,
				classifier, dataHandler, incentiveMechanism)
		})
	}
}
