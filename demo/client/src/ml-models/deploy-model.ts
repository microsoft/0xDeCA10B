import Web3 from 'web3'
import { Contract } from 'web3-eth-contract'
import DensePerceptron from '../contracts/compiled/DensePerceptron.json'
import NaiveBayesClassifier from '../contracts/compiled/NaiveBayesClassifier.json'
import NearestCentroidClassifier from '../contracts/compiled/NearestCentroidClassifier.json'
import SparseNearestCentroidClassifier from '../contracts/compiled/SparseNearestCentroidClassifier.json'
import SparsePerceptron from '../contracts/compiled/SparsePerceptron.json'
import { convertDataToHex, convertToHex } from '../float-utils'
import { DensePerceptronModel, Model, NaiveBayesModel, NearestCentroidModel, SparseNearestCentroidModel, SparsePerceptronModel } from './model-interfaces'

export class ModelDeployer {
	/**
	 * The default value for toFloat.
	 */
	private static readonly toFloat = 1E9

	/**
	 * Block gas limit by most miners as of October 2019.
	 */
	public readonly gasLimit = 8.9E6

	static readonly modelTypes: any = {
		'naive bayes': NaiveBayesClassifier,
		'nearest centroid classifier': NearestCentroidClassifier,
		'dense nearest centroid classifier': NearestCentroidClassifier,
		'sparse nearest centroid classifier': SparseNearestCentroidClassifier,
		'perceptron': DensePerceptron,
		'dense perceptron': DensePerceptron,
		'sparse perceptron': SparsePerceptron,
	}

	constructor(private web3: Web3) {
	}

	async deployNaiveBayes(model: NaiveBayesModel, options: any): Promise<Contract> {
		const { account, toFloat,
			notify, dismissNotification,
			saveTransactionHash, saveAddress,
		} = options

		const defaultSmoothingFactor = 1
		const initialFeatureChunkSize = 150
		const featureChunkSize = 350
		const { classifications, classCounts, featureCounts, totalNumFeatures } = model
		const smoothingFactor = convertToHex(model.smoothingFactor || defaultSmoothingFactor, this.web3, toFloat)

		const ContractInfo = ModelDeployer.modelTypes[model.type]
		const contract = new this.web3.eth.Contract(ContractInfo.abi, undefined, { from: account })
		const pleaseAcceptKey = notify(`Please accept the prompt to deploy the Naive Bayes classifier`)

		return contract.deploy({
			data: ContractInfo.bytecode,
			arguments: [[classifications[0]], [classCounts[0]], [featureCounts[0].slice(0, initialFeatureChunkSize)], totalNumFeatures, smoothingFactor]
		}).send({
			from: account,
			gas: this.gasLimit,
		}).on('transactionHash', transactionHash => {
			dismissNotification(pleaseAcceptKey)
			notify(`Submitted the model with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`)
			saveTransactionHash('model', transactionHash)
		}).on('error', err => {
			dismissNotification(pleaseAcceptKey)
			notify("Error deploying the model", { variant: 'error' })
			throw err
		}).then(async newContractInstance => {
			const addClassPromises = []
			for (let i = 1; i < classifications.length; ++i) {
				addClassPromises.push(new Promise((resolve, reject) => {
					const notification = notify(`Please accept the prompt to create the "${classifications[i]}" class`)
					newContractInstance.methods.addClass(
						classCounts[i], featureCounts[i].slice(0, initialFeatureChunkSize), classifications[i]
					).send({
						from: account,
						// Block gas limit by most miners as of October 2019.
						gas: this.gasLimit,
					}).on('transactionHash', () => {
						dismissNotification(notification)
					}).on('error', (err: any) => {
						dismissNotification(notification)
						notify(`Error creating the "${classifications[i]}" class`, { variant: 'error' })
						reject(err)
					}).then(resolve)

				}))
			}
			return Promise.all(addClassPromises).then(async _ => {
				// Add remaining feature counts.
				for (let classification = 0; classification < classifications.length; ++classification) {
					for (let j = initialFeatureChunkSize; j < featureCounts[classification].length; j += featureChunkSize) {
						const notification = notify(`Please accept the prompt to upload the features [${j},${Math.min(j + featureChunkSize, featureCounts[classification].length)}) for the "${classifications[classification]}" class`)
						await newContractInstance.methods.initializeCounts(
							featureCounts[classification].slice(j, j + featureChunkSize), classification).send().on('transactionHash', () => {
								dismissNotification(notification)
							}).on('error', (err: any) => {
								dismissNotification(notification)
								notify(`Error setting feature indices for [${j},${Math.min(j + featureChunkSize, featureCounts[classification].length)}) for the "${classifications[classification]}" class`, { variant: 'error' })
								throw err
							})
					}
				}
				notify(`The model contract has been deployed to ${newContractInstance.options.address}`, { variant: 'success' })
				saveAddress('model', newContractInstance.options.address)
				return newContractInstance
			})
		})
	}

	async deployNearestCentroidClassifier(model: NearestCentroidModel | SparseNearestCentroidModel, options: any): Promise<Contract> {
		const { account, toFloat,
			notify, dismissNotification,
			saveTransactionHash, saveAddress,
		} = options
		const initialChunkSize = 500
		const chunkSize = 500
		const classifications: string[] = []
		const centroids: number[][] | number[][][] = []
		const dataCounts: number[] = []
		let numDimensions = null
		for (let [classification, centroidInfo] of Object.entries(model.centroids)) {
			classifications.push(classification)
			dataCounts.push(centroidInfo.dataCount)
			if (Array.isArray(centroidInfo.centroid)) {
				centroids.push(convertDataToHex(centroidInfo.centroid, this.web3, toFloat))
				if (numDimensions === null) {
					numDimensions = centroidInfo.centroid.length
				} else {
					if (centroidInfo.centroid.length !== numDimensions) {
						throw new Error(`Found a centroid with ${centroidInfo.centroid.length} dimensions. Expected: ${numDimensions}.`)
					}
				}
			} else {
				const sparseCentroid: number[][] = []
				for (let [featureIndexKey, value] of Object.entries(centroidInfo.centroid)) {
					const featureIndex = parseInt(featureIndexKey)
					sparseCentroid.push([this.web3.utils.toHex(featureIndex), convertToHex(value, this.web3, toFloat)])
				}
				centroids.push(sparseCentroid as any)
			}
		}

		const ContractInfo = ModelDeployer.modelTypes[model.type]
		const contract = new this.web3.eth.Contract(ContractInfo.abi, undefined, { from: account })
		const pleaseAcceptKey = notify("Please accept the prompt to deploy the first class for the Nearest Centroid classifier")
		return contract.deploy({
			data: ContractInfo.bytecode,
			arguments: [[classifications[0]], [centroids[0].slice(0, initialChunkSize)], [dataCounts[0]]],
		}).send({
			from: account,
			// Block gas limit by most miners as of October 2019.
			gas: this.gasLimit,
		}).on('transactionHash', transactionHash => {
			dismissNotification(pleaseAcceptKey)
			notify(`Submitted the model with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`)
			saveTransactionHash('model', transactionHash)
		}).on('error', err => {
			dismissNotification(pleaseAcceptKey)
			notify("Error deploying the model", { variant: 'error' })
			throw err
		}).then(async newContractInstance => {
			// Set up each class.
			const addClassPromises = []
			for (let i = 1; i < classifications.length; ++i) {
				addClassPromises.push(new Promise((resolve, reject) => {
					const notification = notify(`Please accept the prompt to create the "${classifications[i]}" class`)
					newContractInstance.methods.addClass(centroids[i].slice(0, initialChunkSize), classifications[i], dataCounts[i]).send({
						from: account,
						// Block gas limit by most miners as of October 2019.
						gas: this.gasLimit,
					}).on('transactionHash', () => {
						dismissNotification(notification)
					}).on('error', (err: any) => {
						dismissNotification(notification)
						notify(`Error creating the "${classifications[i]}" class`, { variant: 'error' })
						reject(err)
					}).then(resolve)
				}))
			}
			await Promise.all(addClassPromises)
			// Extend each class.
			// Tried with promises but got weird unhelpful errors from Truffle (some were like network timeout errors).
			for (let classification = 0; classification < classifications.length; ++classification) {
				for (let j = initialChunkSize; j < centroids[classification].length; j += chunkSize) {
					const notification = notify(`Please accept the prompt to upload the values for dimensions [${j},${j + chunkSize}) for the "${classifications[classification]}" class`)
					await newContractInstance.methods.extendCentroid(
						centroids[classification].slice(j, j + chunkSize), classification).send().on('transactionHash', () => {
							dismissNotification(notification)
						}).on('error', (err: any) => {
							dismissNotification(notification)
							notify(`Error setting feature indices for [${j},${j + chunkSize}) for the "${classifications[classification]}" class`, { variant: 'error' })
							throw err
						})
				}
			}

			notify(`The model contract has been deployed to ${newContractInstance.options.address}`, { variant: 'success' })
			saveAddress('model', newContractInstance.options.address)
			return newContractInstance
		})
	}

	async deployPerceptron(model: DensePerceptronModel | SparsePerceptronModel, options: any): Promise<Contract> {
		const { account, toFloat,
			notify, dismissNotification,
			saveTransactionHash, saveAddress,
		} = options
		const defaultLearningRate = 0.5
		const weightChunkSize = 450
		const { classifications, featureIndices } = model
		let weightsArray: any[] = []
		let sparseWeights: any[][] = []

		if (model.hasOwnProperty('sparseWeights')) {
			const sparseModel = model as SparsePerceptronModel
			if (typeof sparseModel.sparseWeights === 'object' && sparseModel.sparseWeights !== null) {
				for (let [featureIndexKey, weight] of Object.entries(sparseModel.sparseWeights)) {
					const featureIndex = parseInt(featureIndexKey, 10)
					sparseWeights.push([this.web3.utils.toHex(featureIndex), convertToHex(weight, this.web3, toFloat)])
				}
			}
		}

		if (model.weights !== undefined && model.weights !== null && Array.isArray(model.weights)) {
			weightsArray = convertDataToHex(model.weights, this.web3, toFloat)
		}
		const intercept = convertToHex(model.intercept, this.web3, toFloat)
		const learningRate = convertToHex(model.learningRate || defaultLearningRate, this.web3, toFloat)

		if (featureIndices !== undefined && featureIndices.length !== weightsArray.length + sparseWeights.length) {
			return Promise.reject("The number of features must match the number of weights.")
		}

		const ContractInfo = ModelDeployer.modelTypes[model.type]
		const contract = new this.web3.eth.Contract(ContractInfo.abi, undefined, { from: account })
		const pleaseAcceptKey = notify(`Please accept the prompt to deploy the Perceptron classifier with the first ${Math.min(weightsArray.length, weightChunkSize)} weights`)
		return contract.deploy({
			data: ContractInfo.bytecode,
			arguments: [classifications, weightsArray.slice(0, weightChunkSize), intercept, learningRate],
		}).send({
			from: account,
			gas: this.gasLimit,
		}).on('transactionHash', transactionHash => {
			dismissNotification(pleaseAcceptKey)
			notify(`Submitted the model with transaction hash: ${transactionHash}. Please wait for a deployment confirmation.`)
			saveTransactionHash('model', transactionHash)
		}).on('error', err => {
			dismissNotification(pleaseAcceptKey)
			notify("Error deploying the model", { variant: 'error' })
			throw err
		}).then(async newContractInstance => {
			// Could create a batch but I was getting various errors when trying to do and could not find docs on what `execute` returns.
			const transactions = []
			// Add remaining weights.
			for (let i = weightChunkSize; i < weightsArray.length; i += weightChunkSize) {
				let transaction: any
				if (model.type === 'dense perceptron' || model.type === 'perceptron') {
					transaction = newContractInstance.methods.initializeWeights(weightsArray.slice(i, i + weightChunkSize))
				} else if (model.type === 'sparse perceptron') {
					transaction = newContractInstance.methods.initializeWeights(i, weightsArray.slice(i, i + weightChunkSize))
				} else {
					throw new Error(`Unrecognized model type: "${model.type}"`)
				}
				transactions.push(new Promise((resolve, reject) => {
					// Subtract 1 from the count because the first chunk has already been uploaded.
					const notification = notify(`Please accept the prompt to upload classifier 
					weights [${i},${i + weightChunkSize}) (${i / weightChunkSize}/${Math.ceil(weightsArray.length / weightChunkSize) - 1})`)
					transaction.send().on('transactionHash', () => {
						dismissNotification(notification)
					}).on('error', (err: any) => {
						dismissNotification(notification)
						notify(`Error setting weights classifier weights [${i},${i + weightChunkSize})`, { variant: 'error' })
						reject(err)
					}).then(resolve)
				}))
			}
			if (featureIndices !== undefined) {
				// Add feature indices to use.
				for (let i = 0; i < featureIndices.length; i += weightChunkSize) {
					transactions.push(new Promise((resolve, reject) => {
						const notification = notify(`Please accept the prompt to upload the feature indices [${i},${i + weightChunkSize})`)
						newContractInstance.methods.addFeatureIndices(featureIndices.slice(i, i + weightChunkSize)).send()
							.on('transactionHash', () => {
								dismissNotification(notification)
							}).on('error', (err: any) => {
								dismissNotification(notification)
								notify(`Error setting feature indices for [${i},${i + weightChunkSize})`, { variant: 'error' })
								reject(err)
							}).then(resolve)
					}))
				}
			}

			await Promise.all(transactions)

			for (let i = 0; i < sparseWeights.length; i += Math.round(weightChunkSize / 2)) {
				const notification = notify(`Please accept the prompt to upload sparse classifier weights [${i},${i + Math.round(weightChunkSize / 2)}) out of ${sparseWeights.length}`)
				await newContractInstance.methods.initializeSparseWeights(
					sparseWeights.slice(i, i + Math.round(weightChunkSize / 2))).send().on('transactionHash', () => {
						dismissNotification(notification)
					}).on('error', (err: any) => {
						dismissNotification(notification)
						notify(`Error setting sparse classifier weights [${i},${i + Math.round(weightChunkSize / 2)}) out of ${sparseWeights.length}`, { variant: 'error' })
						throw err
					})
			}

			notify(`The model contract has been deployed to ${newContractInstance.options.address}`, { variant: 'success' })
			saveAddress('model', newContractInstance.options.address)
			return newContractInstance
		})
	}

	/**
	 * @returns The contract for the model, an instance of `Classifier64`
	 * along with the the total amount of gas used to deploy the model.
	 */
	async deployModel(model: Model, options: any): Promise<Contract> {
		if (options.toFloat === undefined) {
			options.toFloat = ModelDeployer.toFloat
		}
		if (options.notify === undefined) {
			options.notify = (() => { })
		}
		if (options.dismissNotification === undefined) {
			options.dismissNotification = (() => { })
		}
		if (options.saveAddress === undefined) {
			options.saveAddress = (() => { })
		}
		if (options.saveTransactionHash === undefined) {
			options.saveTransactionHash = (() => { })
		}

		switch (model.type.toLocaleLowerCase('en')) {
			case 'dense perceptron':
			case 'sparse perceptron':
			case 'perceptron':
				if (model.hasOwnProperty('sparseWeights')) {
					return this.deployPerceptron(model as SparsePerceptronModel, options)
				} else {
					return this.deployPerceptron(model as DensePerceptronModel, options)
				}
			case 'naive bayes':
				return this.deployNaiveBayes(model as NaiveBayesModel, options)
			case 'dense nearest centroid classifier':
			case 'nearest centroid classifier':
				return this.deployNearestCentroidClassifier(model as NearestCentroidModel, options)
			case 'sparse nearest centroid classifier':
				return this.deployNearestCentroidClassifier(model as SparseNearestCentroidModel, options)
			default:
				// Should not happen.
				throw new Error(`Unrecognized model type: "${model.type}"`)
		}
	}
}