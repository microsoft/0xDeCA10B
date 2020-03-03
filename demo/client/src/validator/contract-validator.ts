import Web3 from 'web3'
import { Contract } from 'web3-eth-contract'
import Classifier from "../contracts/compiled/Classifier64.json"
import CollaborativeTrainer from '../contracts/compiled/CollaborativeTrainer64.json'
import DataHandler from '../contracts/compiled/DataHandler64.json'
import IncentiveMechanism from '../contracts/compiled/IncentiveMechanism.json'

/**
 * The result of checking if a contract is valid.
 */
export class ValidationStatus {
	isValid: boolean
	reason?: string

	constructor(isValid: boolean, reason?: string) {
		this.isValid = isValid
		this.reason = reason
	}
}

/**
 * Help validate if a contract can be used with the system.
 */
export class ContractValidator {
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
	async isValid(address: string): Promise<ValidationStatus> {
		if (!address || address.length === 0) {
			return new ValidationStatus(false, "No address given.")
		}
		try {
			await this.web3.eth.getCode(address)
		} catch (err) {
			return new ValidationStatus(false, err.toString())
		}

		// It is a valid address, so check the other interfaces.
		const mainEntryPoint = this.getContractInstance({
			abi: CollaborativeTrainer.abi,
			address,
		})
		return Promise.all([
			mainEntryPoint.methods.dataHandler().call().then((dataHandlerAddress: string) => {
				return this.getContractInstance({
					abi: DataHandler.abi,
					address: dataHandlerAddress
				})
			}),
			mainEntryPoint.methods.classifier().call().then((classifierAddress: string) => {
				return this.getContractInstance({
					abi: Classifier.abi,
					address: classifierAddress
				})
			}),
			mainEntryPoint.methods.incentiveMechanism().call().then((incentiveMechanismAddress: string) => {
				return this.getContractInstance({
					abi: IncentiveMechanism.abi,
					address: incentiveMechanismAddress
				})
			})
		]).then(_ => {
			return new ValidationStatus(true)
		}).catch((err: any) => {
			return new ValidationStatus(false, "The address is not a valid contract for this application.")
		})
	}
}
