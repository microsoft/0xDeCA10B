const fs = require('fs')

const DensePerceptron = artifacts.require("classification/DensePerceptron")
const NaiveBayesClassifier = artifacts.require("./classification/NaiveBayesClassifier")
const NearestCentroidClassifier = artifacts.require("./classification/NearestCentroidClassifier")
const SparseNearestCentroidClassifier = artifacts.require("./classification/SparseNearestCentroidClassifier")
const SparsePerceptron = artifacts.require("./classification/SparsePerceptron")

const { convertData, convertNum } = require('../../src/float-utils-node');

const _toFloat = 1E9

async function loadDensePerceptron(model, web3, toFloat) {
    let gasUsed = 0
    const weightChunkSize = 450
    const { classifications } = model
    const weights = convertData(model.weights, web3, toFloat);
    const intercept = convertNum(model.bias, web3, toFloat);
    const learningRate = convertNum(1, web3, toFloat);
    console.log(`  Deploying Dense Perceptron classifier with first ${Math.min(weights.length, weightChunkSize)} weights.`);
    const classifierContract = await DensePerceptron.new(classifications, weights.slice(0, weightChunkSize), intercept, learningRate)
    gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed

    // Add remaining weights.
    for (let i = weightChunkSize; i < weights.length; i += weightChunkSize) {
        console.log(`    Adding classifier weights [${i}, ${Math.min(i + weightChunkSize, weights.length)}).`);
        const r = await classifierContract.initializeWeights(weights.slice(i, i + weightChunkSize))
        gasUsed += r.receipt.gasUsed
    }

    console.log(`  Deployed Dense Perceptron classifier to ${classifierContract.address}. gasUsed: ${gasUsed}`)

    return {
        classifierContract,
        gasUsed,
    }
}

async function loadSparsePerceptron(model, web3, toFloat) {
    let gasUsed = 0
    const weightChunkSize = 450
    const { classifications } = model
    const weights = convertData(model.weights, web3, toFloat)
    const intercept = convertNum(model.bias, web3, toFloat)
    const learningRate = convertNum(1, web3, toFloat)
    console.log(`  Deploying Sparse Perceptron classifier with first ${Math.min(weights.length, weightChunkSize)} weights.`)
    const classifierContract = await SparsePerceptron.new(classifications, weights.slice(0, weightChunkSize), intercept, learningRate)
    gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed

    // Add remaining weights.
    for (let i = weightChunkSize; i < weights.length; i += weightChunkSize) {
        console.log(`    Adding classifier weights [${i}, ${Math.min(i + weightChunkSize, weights.length)}).`)
        const r = await classifierContract.initializeWeights(i, weights.slice(i, i + weightChunkSize))
        gasUsed += r.receipt.gasUsed
    }

    console.log(`  Deployed Sparse Perceptron classifier to ${classifierContract.address}. gasUsed: ${gasUsed}`)

    return {
        classifierContract,
        gasUsed,
    }
}

async function loadNearestCentroidClassifier(model, web3, toFloat) {
    let gasUsed = 0
    const classifications = []
    const centroids = []
    const dataCounts = []
    console.log("  Deploying Nearest Centroid Classifier model.")
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

    const classifierContract = await NearestCentroidClassifier.new(
        [classifications[0]], [centroids[0]], [dataCounts[0]],
        { gas: 8.9E6 }
    )

    gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed
    console.log(`  Deployed classifier to ${classifierContract.address}. gasUsed: ${gasUsed}`)
    // Add classes separately to avoid hitting gasLimit.
    const addClassPromises = []
    for (let i = 1; i < classifications.length; ++i) {
        addClassPromises.push(classifierContract.addClass(centroids[i], classifications[i], dataCounts[i]))
    }
    return Promise.all(addClassPromises).then(responses => {
        console.log("  All classes added.")
        for (const r of responses) {
            gasUsed += r.receipt.gasUsed
        }
        return {
            classifierContract,
            gasUsed,
        }
    })
}

async function loadSparseNearestCentroidClassifier(model, web3, toFloat) {
    let gasUsed = 0
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
        [classifications[0]], [centroids[0].slice(0, chunkSize)], [dataCounts[0]],
        { gas: 8.9E6 }
    )

    gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed
    console.log(`  Deployed classifier to ${classifierContract.address}. gasUsed: ${gasUsed}`)
    // Add classes separately to avoid hitting gasLimit.
    const addClassPromises = []
    for (let i = 1; i < classifications.length; ++i) {
        addClassPromises.push(classifierContract.addClass(centroids[i].slice(0, chunkSize), classifications[i], dataCounts[i]))
    }
    return Promise.all(addClassPromises).then(responses => {
        console.log("  All classes added.")
        for (const r of responses) {
            gasUsed += r.receipt.gasUsed
        }

        // Add remaining dimensions.
        console.log("Adding remaining dimensions.")
        const extensionPromises = []
        for (let classification = 0; i < classifications.length; ++classification) {
            for (let j = chunkSize; j < centroids[classification].length; j += chunkSize) {
                extensionPromises.push(await classifierContract.extendCentroid(centroids[classification].slice(j, j + chunkSize), classification))
            }
        }
        return Promise.all(extensionPromises).then(responses => {
            for (const r of responses) {
                gasUsed += r.receipt.gasUsed
            }
            console.log(`  Set all centroids. gasUsed: ${gasUsed}.`)
            return {
                classifierContract,
                gasUsed,
            }
        })
    })
}

async function loadNaiveBayes(model, web3, toFloat) {
    let gasUsed = 0
    const featureChunkSize = 500
    const { classifications, classCounts, featureCounts, totalNumFeatures } = model
    const smoothingFactor = convertNum(model.smoothingFactor, web3, toFloat)
    console.log(`  Deploying Naive Bayes classifier.`)

    const classifierContract = await NaiveBayesClassifier.new([classifications[0]], [classCounts[0]], [featureCounts[0].slice(0, featureChunkSize)], totalNumFeatures, smoothingFactor)
    gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed

    const addClassPromises = []
    for (let i = 1; i < classifications.length; ++i) {
        addClassPromises.push(classifierContract.addClass(
            classCounts[i], featureCounts[i].slice(0, featureChunkSize), classifications[i]
        ))
    }
    return Promise.all(addClassPromises).then(responses => {
        for (const r of responses) {
            gasUsed += r.receipt.gasUsed
        }
        // Add remaining feature counts.
        const initializeCountsPromises = []
        for (let classification = 0; i < classifications.length; ++classification) {
            for (let j = featureChunkSize; j < featureCounts[classification].length; j += featureChunkSize) {
                initializeCountsPromises.push(await classifierContract.initializeCounts(featureCounts[classification].slice(j, j + featureChunkSize), classification))
            }
        }
        return Promise.all(initializeCountsPromises).then(responses => {
            for (const r of responses) {
                gasUsed += r.receipt.gasUsed
            }
            console.log(`  Deployed all Naive Bayes classifier classes. gasUsed: ${gasUsed}.`)
            return {
                classifierContract,
                gasUsed,
            }
        })
    })
}

/**
 * @returns The contract for the model, an instance of `Classifier64`
 * along with the the total amount of gas used to deploy the model.
 */
exports.loadModel = async function (path, web3, toFloat = _toFloat) {
    const model = JSON.parse(fs.readFileSync(path, 'utf8'))
    switch (model.type) {
        case 'dense perceptron':
            return loadDensePerceptron(model, web3, toFloat)
        case 'naive bayes':
            return loadNaiveBayes(model, web3, toFloat)
        case 'dense nearest centroid classifier':
        case 'nearest centroid classifier':
            return loadNearestCentroidClassifier(model, web3, toFloat)
        case 'sparse nearest centroid classifier':
            return loadSparseNearestCentroidClassifier(model, web3, toFloat)
        case 'sparse perceptron':
            return loadSparsePerceptron(model, web3, toFloat)
        default:
            // Should not happen.
            throw new Error(`Unrecognized model type: "${model.type}"`)
    }
}
