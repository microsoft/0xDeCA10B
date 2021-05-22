import Web3 from 'web3'
import { Contract } from 'web3-eth-contract'
import DensePerceptron from '../contracts/compiled/DensePerceptron.json'
import NaiveBayesClassifier from '../contracts/compiled/NaiveBayesClassifier.json'
import NearestCentroidClassifier from '../contracts/compiled/NearestCentroidClassifier.json'
import SparseNearestCentroidClassifier from '../contracts/compiled/SparseNearestCentroidClassifier.json'
import SparsePerceptron from '../contracts/compiled/SparsePerceptron.json'
import { convertData, convertNum } from '../float-utils'
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
			saveTransactionHash, saveAddress, initialChunkSize = 150, chunkSize = 350,
		} = options

		const defaultSmoothingFactor = 1

		const { classifications, classCounts, featureCounts, totalNumFeatures } = model
		const smoothingFactor = convertNum(model.smoothingFactor || defaultSmoothingFactor, this.web3, toFloat)

		const ContractInfo = ModelDeployer.modelTypes[model.type]
		const contract = new this.web3.eth.Contract(ContractInfo.abi, undefined, { from: account })
		const pleaseAcceptKey = notify(`Please accept the prompt to deploy the Naive Bayes classifier`)

		return contract.deploy({
			data: ContractInfo.bytecode,
			arguments: [[classifications[0]], [classCounts[0]], [featureCounts[0].slice(0, initialChunkSize)], totalNumFeatures, smoothingFactor]
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
			console.error(err)
		}).then(async newContractInstance => {
			const addClassPromises = []
			for (let i = 1; i < classifications.length; ++i) {
				addClassPromises.push(new Promise((resolve, reject) => {
					const notification = notify(`Please accept the prompt to create the "${classifications[i]}" class`)
					newContractInstance.methods.addClass(
						classCounts[i], featureCounts[i].slice(0, initialChunkSize), classifications[i]
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
					for (let j = initialChunkSize; j < featureCounts[classification].length; j += chunkSize) {
						const notification = notify(`Please accept the prompt to upload the features [${j},${Math.min(j + chunkSize, featureCounts[classification].length)}) for the "${classifications[classification]}" class`)
						await newContractInstance.methods.initializeCounts(
							featureCounts[classification].slice(j, j + chunkSize), classification).send().on('transactionHash', () => {
								dismissNotification(notification)
							}).on('error', (err: any) => {
								dismissNotification(notification)
								notify(`Error setting feature indices for [${j},${Math.min(j + chunkSize, featureCounts[classification].length)}) for the "${classifications[classification]}" class`, { variant: 'error' })
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
			saveTransactionHash, saveAddress, initialChunkSize = 200, chunkSize = 250,
		} = options

		const classifications: string[] = []
		const centroids: number[][] | number[][][] = []
		const dataCounts: number[] = []
		let numDimensions = null
		for (let [classification, centroidInfo] of Object.entries(model.centroids)) {
			classifications.push(classification)
			dataCounts.push(centroidInfo.dataCount)
			if (Array.isArray(centroidInfo.centroid) && model.type !== 'sparse nearest centroid classifier') {
				centroids.push(convertData(centroidInfo.centroid, this.web3, toFloat))
				if (numDimensions === null) {
					numDimensions = centroidInfo.centroid.length
				} else {
					if (centroidInfo.centroid.length !== numDimensions) {
						throw new Error(`Found a centroid with ${centroidInfo.centroid.length} dimensions. Expected: ${numDimensions}.`)
					}
				}
			} else {
				const sparseCentroid: number[][] = []
				// `centroidInfo.centroid` could be an array or dict.
				for (let [featureIndexKey, value] of Object.entries(centroidInfo.centroid)) {
					const featureIndex = parseInt(featureIndexKey)
					sparseCentroid.push([featureIndex, convertNum(value, this.web3, toFloat)])
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
			console.error(err)
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
			for (let classification = 0; classification < classifications.length; ++classification) {
				for (let j = initialChunkSize; j < centroids[classification].length; j += chunkSize) {
					const notification = notify(`Please accept the prompt to upload the values for dimensions [${j},${Math.min(j + chunkSize, centroids[classification].length)}) for the "${classifications[classification]}" class`)
					// Not parallel since order matters.
					await newContractInstance.methods.extendCentroid(
						centroids[classification].slice(j, j + chunkSize), classification).send().on('transactionHash', () => {
							dismissNotification(notification)
						}).on('error', (err: any) => {
							dismissNotification(notification)
							notify(`Error setting feature indices for [${j},${Math.min(j + chunkSize, centroids[classification].length)}) for the "${classifications[classification]}" class`, { variant: 'error' })
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
			saveTransactionHash, saveAddress, chunkSize = 350,
		} = options
		const defaultLearningRate = 0.5

		const { classifications, featureIndices } = model
		let weightsArray: any[] = []
		let sparseWeights: any[][] = []

		if (model.hasOwnProperty('sparseWeights')) {
			const sparseModel = model as SparsePerceptronModel
			if (typeof sparseModel.sparseWeights === 'object' && sparseModel.sparseWeights !== null) {
				for (let [featureIndexKey, weight] of Object.entries(sparseModel.sparseWeights)) {
					const featureIndex = parseInt(featureIndexKey, 10)
					sparseWeights.push([featureIndex, convertNum(weight, this.web3, toFloat)])
				}
			}
		}

		if (model.weights !== undefined && model.weights !== null && Array.isArray(model.weights)) {
			weightsArray = convertData(model.weights, this.web3, toFloat)
		}
		const intercept = convertNum(model.intercept, this.web3, toFloat)
		const learningRate = convertNum(model.learningRate || defaultLearningRate, this.web3, toFloat)

		if (featureIndices !== undefined && featureIndices.length !== weightsArray.length + sparseWeights.length) {
			return Promise.reject("The number of features must match the number of weights.")
		}

		const ContractInfo = ModelDeployer.modelTypes[model.type]
		const contract = new this.web3.eth.Contract(ContractInfo.abi, undefined, { from: account })
		const pleaseAcceptKey = notify(`Please accept the prompt to deploy the Perceptron classifier with the first ${Math.min(weightsArray.length, chunkSize)} weights`)
		return contract.deploy({
			data: ContractInfo.bytecode,
			arguments: [classifications, weightsArray.slice(0, chunkSize), intercept, learningRate],
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
			console.error(err)
		}).then(async newContractInstance => {
			// Add remaining weights.
			for (let i = chunkSize; i < weightsArray.length; i += chunkSize) {
				// Not parallel since order matters for the dense model.
				// Even for the sparse model, it nice not to be bombarded with many notifications that can look out of order.
				let transaction: any
				if (model.type === 'dense perceptron' || model.type === 'perceptron') {
					transaction = newContractInstance.methods.initializeWeights(weightsArray.slice(i, i + chunkSize))
				} else if (model.type === 'sparse perceptron') {
					transaction = newContractInstance.methods.initializeWeights(i, weightsArray.slice(i, i + chunkSize))
				} else {
					throw new Error(`Unrecognized model type: "${model.type}"`)
				}
				// Subtract 1 from the count because the first chunk has already been uploaded.
				const notification = notify(`Please accept the prompt to upload classifier 
					weights [${i},${Math.min(i + chunkSize, weightsArray.length)}) (${i / chunkSize}/${Math.ceil(weightsArray.length / chunkSize) - 1})`)
				await transaction.send({
					from: account,
					gas: this.gasLimit,
				}).on('transactionHash', () => {
					dismissNotification(notification)
				}).on('error', (err: any) => {
					dismissNotification(notification)
					notify(`Error setting weights classifier weights [${i},${Math.min(i + chunkSize, weightsArray.length)})`, { variant: 'error' })
					console.error(err)
				})
			}
			if (featureIndices !== undefined) {
				// Add feature indices to use.
				for (let i = 0; i < featureIndices.length; i += chunkSize) {
					const notification = notify(`Please accept the prompt to upload the feature indices [${i},${Math.min(i + chunkSize, featureIndices.length)})`)
					await newContractInstance.methods.addFeatureIndices(featureIndices.slice(i, i + chunkSize)).send({
						from: account,
						gas: this.gasLimit,
					}).on('transactionHash', () => {
						dismissNotification(notification)
					}).on('error', (err: any) => {
						dismissNotification(notification)
						notify(`Error setting feature indices for [${i},${Math.min(i + chunkSize, featureIndices.length)})`, { variant: 'error' })
						console.error(err)
					})
				}
			}

			const sparseWeightsChunkSize = Math.round(chunkSize / 2)
			for (let i = 0; i < sparseWeights.length; i += sparseWeightsChunkSize) {
				const notification = notify(`Please accept the prompt to upload sparse classifier weights [${i},${Math.min(i + sparseWeightsChunkSize, sparseWeights.length)}) out of ${sparseWeights.length}`)
				await newContractInstance.methods.initializeSparseWeights(sparseWeights.slice(i, i + sparseWeightsChunkSize)).send({
					from: account,
					gas: this.gasLimit,
				}).on('transactionHash', () => {
					dismissNotification(notification)
				}).on('error', (err: any) => {
					dismissNotification(notification)
					notify(`Error setting sparse classifier weights [${i},${Math.min(i + sparseWeightsChunkSize, sparseWeights.length)}) out of ${sparseWeights.length}`, { variant: 'error' })
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