const fs = require('fs')

const DensePerceptron = artifacts.require("./classification/DensePerceptron")
const NaiveBayesClassifier = artifacts.require("./classification/NaiveBayesClassifier")
const NearestCentroidClassifier = artifacts.require("./classification/NearestCentroidClassifier")
const SparseNearestCentroidClassifier = artifacts.require("./classification/SparseNearestCentroidClassifier")
const SparsePerceptron = artifacts.require("./classification/SparsePerceptron")

const { convertData, convertNum } = require('../float-utils-node')

const _toFloat = 1E9

async function deployDensePerceptron(model, web3, options){
    const {toFloat, initialChunkSize = 200, chunkSize = 450,
    } = options
    let gasUsed = 0
    const { classifications } = model
    const weights = convertData(model.weights, web3, toFloat)
    const intercept = convertNum(model.intercept || model.bias, web3, toFloat)
    const learningRate = convertNum(model.learningRate || 1, web3, toFloat)

    // TODO Handle feature indices.
    if (model.featureIndices) {
        throw new Error("featureIndices are not supported yet.")
    }

    console.log(`  Deploying Dense Perceptron classifier with first ${Math.min(weights.length, chunkSize)} weights.`)
    const classifierContract = await DensePerceptron.new(classifications, weights.slice(0, chunkSize), intercept, learningRate)
    gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed

    // Add remaining weights.
    for (let i = chunkSize; i < weights.length; i += chunkSize) {
        // Do not parallelize so that weights are set in order.
        const r = await classifierContract.initializeWeights(weights.slice(i, i + chunkSize))
        console.debug(`    Added classifier weights [${i}, ${Math.min(i + chunkSize, weights.length)}). gasUsed: ${r.receipt.gasUsed}`)
        gasUsed += r.receipt.gasUsed
    }

    console.log(`  Deployed Dense Perceptron classifier to ${classifierContract.address}. gasUsed: ${gasUsed}`)

    return {
        classifierContract,
        gasUsed,
    }
}

async function deploySparsePerceptron(model, web3, options){
    const {toFloat, initialChunkSize = 200, chunkSize = 300,
    } = options
    const { classifications } = model
    const weights = convertData(model.weights, web3, toFloat)
    const intercept = convertNum(model.intercept || model.bias, web3, toFloat)
    const learningRate = convertNum(model.learningRate || 1, web3, toFloat)
    const sparseWeights = []

    // TODO Handle feature indices.
    if (model.featureIndices) {
        throw new Error("featureIndices are not supported yet.")
    }

    if (typeof model.sparseWeights === 'object') {
        for (let [featureIndexKey, weight] of Object.entries(model.sparseWeights)) {
            const featureIndex = parseInt(featureIndexKey, 10)
            sparseWeights.push([featureIndex, convertNum(weight, web3, toFloat)])
        }
    }

    console.log(`  Deploying Sparse Perceptron classifier with first ${Math.min(weights.length, chunkSize)} weights...`)
    const classifierContract = await SparsePerceptron.new(classifications, weights.slice(0, chunkSize), intercept, learningRate)
    let gasUsed = (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed
    console.log(`  Deployed Sparse Perceptron classifier with first ${Math.min(weights.length, chunkSize)} weights. gasUsed: ${gasUsed}`)

    // Add remaining weights.
    for (let i = chunkSize; i < weights.length; i += chunkSize) {
        const r = await classifierContract.initializeWeights(i, weights.slice(i, i + chunkSize))
        console.debug(`    Added classifier weights [${i}, ${Math.min(i + chunkSize, weights.length)}) gasUsed: ${r.receipt.gasUsed}`)
        gasUsed += r.receipt.gasUsed
    }

    const sparseWeightsChunkSize = Math.round(chunkSize / 2)
    for (let i = 0; i < sparseWeights.length; i += sparseWeightsChunkSize) {
        const r = await classifierContract.initializeSparseWeights(
            sparseWeights.slice(i, i + sparseWeightsChunkSize))
        console.debug(`    Added sparse classifier weights [${i},${Math.min(i + sparseWeightsChunkSize, sparseWeights.length)}) out of ${sparseWeights.length}. gasUsed: ${r.receipt.gasUsed}`)
        gasUsed += r.receipt.gasUsed
    }

    console.log(`  Deployed Sparse Perceptron classifier to ${classifierContract.address}. gasUsed: ${gasUsed}`)

    return {
        classifierContract,
        gasUsed,
    }
}

async function deployNearestCentroidClassifier(model, web3, options){
    const {toFloat, initialChunkSize = 200, chunkSize = 250,
    } = options
    let gasUsed = 0
    const classifications = []
    const centroids = []
    const dataCounts = []
    // TODO Allow chunking centroids.
    console.log("  Deploying Dense Nearest Centroid Classifier model.")
    let numDimensions = null
    for (let [classification, centroidInfo] of Object.entries(model.centroids || model.intents)) {
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

    const classifierContract = await NearestCentroidClassifier.new(
        [classifications[0]], [centroids[0]], [dataCounts[0]]
    )

    gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed
    console.log(`  Deployed classifier to ${classifierContract.address}. gasUsed: ${gasUsed}`)
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
        return {
            classifierContract,
            gasUsed,
        }
    })
}

exports.deploySparseNearestCentroidClassifier = async function (model, web3, toFloat) {
    let gasUsed = 0
    const initialChunkSize = 200
    const chunkSize = 250
    const classifications = []
    const centroids = []
    const dataCounts = []
    console.log("  Deploying Sparse Nearest Centroid Classifier model.")
    for (let [classification, centroidInfo] of Object.entries(model.centroids || model.intents)) {
        classifications.push(classification)
        const centroid = Object.entries(centroidInfo.centroid).map(([featureIndex, value]) => [parseInt(featureIndex, 10), convertNum(value, web3, toFloat)])
        centroids.push(centroid)
        dataCounts.push(centroidInfo.dataCount)
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

        console.debug("  Adding remaining dimensions.")
        for (let classification = 0; classification < classifications.length; ++classification) {
            for (let j = initialChunkSize; j < centroids[classification].length; j += chunkSize) {
                // Not parallel since order matters within each classification.
                const r = await classifierContract.extendCentroid(
                    centroids[classification].slice(j, j + chunkSize), classification)
                console.debug(`    Added dimensions [${j}, ${Math.min(j + chunkSize, centroids[classification].length)}) for class ${classification}. gasUsed: ${r.receipt.gasUsed}`)
                gasUsed += r.receipt.gasUsed
            }
        }
        console.log(`  Set all centroids. gasUsed: ${gasUsed}.`)
        return {
            classifierContract,
            gasUsed,
        }
    })
}

async function deployNaiveBayes(model, web3, options){
    const {toFloat, initialChunkSize = 150, chunkSize =350,
    } = options
    let gasUsed = 0
    const { classifications, classCounts, featureCounts, totalNumFeatures } = model
    const smoothingFactor = convertNum(model.smoothingFactor, web3, toFloat)
    console.log(`  Deploying Naive Bayes classifier.`)
    const classifierContract = await NaiveBayesClassifier.new([classifications[0]], [classCounts[0]], [featureCounts[0].slice(0, initialChunkSize)], totalNumFeatures, smoothingFactor)
    gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed

    const addClassPromises = []
    for (let i = 1; i < classifications.length; ++i) {
        addClassPromises.push(classifierContract.addClass(
            classCounts[i], featureCounts[i].slice(0, initialChunkSize), classifications[i]
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
            for (let j = initialChunkSize; j < featureCounts[classification].length; j += chunkSize) {
                const r = await classifierContract.initializeCounts(
                    featureCounts[classification].slice(j, j + chunkSize), classification
                )
                console.debug(`    Added features [${j}, ${Math.min(j + chunkSize, featureCounts[classification].length)}) for class ${classification}. gasUsed: ${r.receipt.gasUsed}`)
                gasUsed += r.receipt.gasUsed
            }
        }
        console.debug(`  Deployed all Naive Bayes classifier classes. gasUsed: ${gasUsed}.`)
        return {
            classifierContract,
            gasUsed,
        }
    })
}

/**
 * @param model A model object or a string for the path to a JSON model file.
 * @returns The contract for the model, an instance of `Classifier64`
 * along with the the total amount of gas used to deploy the model.
 */
exports.deployModel = async function (model, web3, toFloat = _toFloat) {
    if (typeof model === 'string') {
        model = JSON.parse(fs.readFileSync(model, 'utf8'))
    }
    switch (model.type) {
        case 'dense perceptron':
            return deployDensePerceptron(model, web3, toFloat)
        case 'naive bayes':
            return deployNaiveBayes(model, web3, toFloat)
        case 'dense nearest centroid classifier':
        case 'nearest centroid classifier':
            return deployNearestCentroidClassifier(model, web3, toFloat)
        case 'sparse nearest centroid classifier':
            return exports.deploySparseNearestCentroidClassifier(model, web3, toFloat)
        case 'sparse perceptron':
            return deploySparsePerceptron(model, web3, toFloat)
        default:
            // Should not happen.
            throw new Error(`Unrecognized model type: "${model.type}"`)
    }
}
