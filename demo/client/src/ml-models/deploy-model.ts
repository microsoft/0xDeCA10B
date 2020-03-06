import Web3 from 'web3'
import { Contract } from 'web3-eth-contract'

import DensePerceptron from '../contracts/compiled/DensePerceptron.json'
import SparsePerceptron from '../contracts/compiled/SparsePerceptron.json'
import NaiveBayesClassifier from '../contracts/compiled/NaiveBayesClassifier.json'
import NearestCentroidClassifier from '../contracts/compiled/NearestCentroidClassifier.json'
import SparseNearestCentroidClassifier from '../contracts/compiled/SparseNearestCentroidClassifier.json'

import { convertData, convertNum } from '../float-utils'

class Model {
	type!: string
}

class CentroidInfo {
	centroid!: number[]
	dataCount!: number
}

class NearestCentroidModel extends Model {

	intents!: Map<string, CentroidInfo>
}

export class ModelDeployer {
	/**
	 * The default value for toFloat.
	 */
	private static readonly toFloat = 1E9

	static readonly modelTypes: any = {
		'dense perceptron': DensePerceptron,
		'sparse perceptron': SparsePerceptron,
		'dense nearest centroid classifier': NearestCentroidClassifier,
		'nearest centroid classifier': NearestCentroidClassifier,
	}

	constructor(private web3: Web3) {
	}

	async deployPerceptron(model: any, options: any): Promise<Contract> {
		const { account, toFloat,
			notify, dismissNotification,
			saveTransactionHash, saveAddress,
		} = options
		const defaultLearningRate = 0.5
		const weightChunkSize = 450
		const { classifications, featureIndices } = model
		const weights = convertData(model.weights, this.web3, toFloat)
		const intercept = convertNum(model.bias, this.web3, toFloat)
		const learningRate = convertNum(model.learningRate || defaultLearningRate, this.web3, toFloat)

		if (featureIndices !== undefined && featureIndices.length !== weights.length) {
			return Promise.reject("The number of features must match the number of weights.")
		}

		const ContractInfo = ModelDeployer.modelTypes[model.type]
		const contract = new this.web3.eth.Contract(ContractInfo.abi, undefined, { from: account })
		const pleaseAcceptKey = notify(`Please accept the prompt to deploy the Perceptron classifier with the first ${Math.min(weights.length, weightChunkSize)} weights`)
		return contract.deploy({
			data: ContractInfo.bytecode,
			arguments: [classifications, weights.slice(0, weightChunkSize), intercept, learningRate],
		}).send({
			from: account,
			// Block gas limit by most miners as of October 2019.
			// gas: 8.9E6,
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
			for (let i = weightChunkSize; i < weights.length; i += weightChunkSize) {
				let transaction: any
				if (model.type === 'dense perceptron') {
					transaction = newContractInstance.methods.initializeWeights(weights.slice(i, i + weightChunkSize))
				} else if (model.type === 'sparse perceptron') {
					transaction = newContractInstance.methods.initializeWeights(i, weights.slice(i, i + weightChunkSize))
				} else {
					throw new Error(`Unrecognized model type: "${model.type}"`)
				}
				transactions.push(new Promise((resolve, reject) => {
					// Subtract 1 from the count because the first chunk has already been uploaded.
					const notification = notify(`Please accept the prompt to upload classifier 
				weights [${i},${i + weightChunkSize}) (${i / weightChunkSize}/${Math.ceil(weights.length / weightChunkSize) - 1})`)
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

			return Promise.all(transactions).then(_ => {
				notify(`The model contract has been deployed to ${newContractInstance.options.address}`, { variant: 'success' })
				saveAddress('model', newContractInstance.options.address)
				return newContractInstance
			})
		})
	}

	async deployNearestCentroidClassifier(model: NearestCentroidModel, options: any): Promise<Contract> {
		const { account, toFloat,
			notify, dismissNotification,
			saveTransactionHash, saveAddress,
		} = options
		const classifications = []
		const centroids = []
		const dataCounts = []
		let numDimensions = null
		for (let [classification, centroidInfo] of Object.entries(model.intents)) {
			classifications.push(classification)
			centroids.push(convertData(centroidInfo.centroid, this.web3, toFloat))
			dataCounts.push(centroidInfo.dataCount)
			if (numDimensions === null) {
				numDimensions = centroidInfo.centroid.length
			} else {
				if (centroidInfo.centroid.length !== numDimensions) {
					throw new Error(`Found a centroid with ${centroidInfo.centroid.length} dimensions. Expected: ${numDimensions}.`)
				}
			}
		}

		const ContractInfo = ModelDeployer.modelTypes[model.type]
		const contract = new this.web3.eth.Contract(ContractInfo.abi, undefined, { from: account })
		const pleaseAcceptKey = notify("Please accept the prompt to deploy the first class for the Nearest Centroid classifier")
		// FIXME
		const classifierContract = await NearestCentroidClassifier.new(
			[classifications[0]], [centroids[0]], [dataCounts[0]]
		)
		// Add classes separately to avoid hitting gasLimit.
		const addClassPromises = []
		for (let i = 1; i < classifications.length; ++i) {
			addClassPromises.push(classifierContract.addClass(centroids[i], classifications[i], dataCounts[i]))
		}
		return Promise.all(addClassPromises).then(responses => {
			console.debug("  All classes added.")
			for (const r of responses) {
				gasUsed += r.receipt.gasUsed
			}
			return classifierContract
		})
	}

	async  deploySparseNearestCentroidClassifier(model: any, options: any): Promise<Contract> {
		// FIXME
		const toFloat = options.toFloat || _toFloat
		let gasUsed = 0
		const initialChunkSize = 500
		const chunkSize = 500
		const classifications = []
		const centroids = []
		const dataCounts = []
		console.log("  Deploying Sparse Nearest Centroid Classifier model.")
		let numDimensions = null
		for (let [classification, centroidInfo] of Object.entries(model.intents)) {
			classifications.push(classification)
			centroids.push(convertData(centroidInfo.centroid, web3, toFloat))
			dataCounts.push(centroidInfo.dataCount)
			if (numDimensions === null) {
				numDimensions = centroidInfo.centroid.length
			} else {
				if (centroidInfo.centroid.length !== numDimensions) {
					throw new Error(`Found a centroid with ${centroidInfo.centroid.length} dimensions. Expected: ${numDimensions}.`)
				}
			}
		}

		const classifierContract = await SparseNearestCentroidClassifier.new(
			[classifications[0]], [centroids[0].slice(0, initialChunkSize)], [dataCounts[0]]
		)

		gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed
		console.log(`  Deployed classifier to ${classifierContract.address}. gasUsed: ${gasUsed}`)
		// Add classes separately to avoid hitting gasLimit.
		const addClassPromises = []
		for (let i = 1; i < classifications.length; ++i) {
			addClassPromises.push(classifierContract.addClass(
				centroids[i].slice(0, initialChunkSize), classifications[i], dataCounts[i]
			).then(r => {
				console.debug(`    Added class ${i}. gasUsed: ${r.receipt.gasUsed}`)
				return r
			}))
		}
		return Promise.all(addClassPromises).then(async responses => {
			console.debug("  All classes added.")
			for (const r of responses) {
				gasUsed += r.receipt.gasUsed
			}

			// Tried with promises but got weird unhelpful errors from Truffle (some were like network timeout errors).
			console.debug("  Adding remaining dimensions.")
			for (let classification = 0; classification < classifications.length; ++classification) {
				for (let j = initialChunkSize; j < centroids[classification].length; j += chunkSize) {
					const r = await classifierContract.extendCentroid(
						centroids[classification].slice(j, j + chunkSize), classification)
					console.debug(`    Added dimensions [${j}, ${Math.min(j + chunkSize, centroids[classification].length)}) for class ${classification}. gasUsed: ${r.receipt.gasUsed}`)
					gasUsed += r.receipt.gasUsed
				}
			}
			console.log(`  Set all centroids. gasUsed: ${gasUsed}.`)
			return classifierContract
		})
	}

	async  deployNaiveBayes(model: any, options: any): Promise<Contract> {
		// FIXME
		const toFloat = options.toFloat || _toFloat
		let gasUsed = 0
		const initialFeatureChunkSize = 150
		const featureChunkSize = 350
		const { classifications, classCounts, featureCounts, totalNumFeatures } = model
		const smoothingFactor = convertNum(model.smoothingFactor, web3, toFloat)
		console.log(`  Deploying Naive Bayes classifier.`)
		const classifierContract = await NaiveBayesClassifier.new([classifications[0]], [classCounts[0]], [featureCounts[0].slice(0, initialFeatureChunkSize)], totalNumFeatures, smoothingFactor)
		gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed

		const addClassPromises = []
		for (let i = 1; i < classifications.length; ++i) {
			addClassPromises.push(classifierContract.addClass(
				classCounts[i], featureCounts[i].slice(0, initialFeatureChunkSize), classifications[i]
			).then(r => {
				console.debug(`    Added class ${i}. gasUsed: ${r.receipt.gasUsed}`)
				return r
			}))
		}
		return Promise.all(addClassPromises).then(async responses => {
			for (const r of responses) {
				gasUsed += r.receipt.gasUsed
			}
			// Add remaining feature counts.
			// Tried with promises but got weird unhelpful errors from Truffle (some were like network timeout errors).
			for (let classification = 0; classification < classifications.length; ++classification) {
				for (let j = initialFeatureChunkSize; j < featureCounts[classification].length; j += featureChunkSize) {
					const r = await classifierContract.initializeCounts(
						featureCounts[classification].slice(j, j + featureChunkSize), classification
					)
					console.debug(`    Added features [${j}, ${Math.min(j + featureChunkSize, featureCounts[classification].length)}) for class ${classification}. gasUsed: ${r.receipt.gasUsed}`)
					gasUsed += r.receipt.gasUsed
				}
			}
			console.debug(`  Deployed all Naive Bayes classifier classes. gasUsed: ${gasUsed}.`)
			return classifierContract
		})
	}

	/**
	 * @returns The contract for the model, an instance of `Classifier64`
	 * along with the the total amount of gas used to deploy the model.
	 */
	async deployModel(model: any, options: any): Promise<Contract> {
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

		switch (model.type) {
			case 'dense perceptron':
			case 'sparse perceptron':
				return this.deployPerceptron(model, options)
			case 'naive bayes':
				return this.deployNaiveBayes(model, options)
			case 'dense nearest centroid classifier':
			case 'nearest centroid classifier':
				return this.deployNearestCentroidClassifier(model, options)
			case 'sparse nearest centroid classifier':
				return this.deploySparseNearestCentroidClassifier(model, options)
			default:
				// Should not happen.
				throw new Error(`Unrecognized model type: "${model.type}"`)
		}
	}
}