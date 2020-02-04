const fs = require('fs')

const DensePerceptron = artifacts.require("classification/DensePerceptron")
const NaiveBayesClassifier = artifacts.require("./classification/NaiveBayesClassifier")
const NearestCentroidClassifier = artifacts.require("./classification/NearestCentroidClassifier")
const SparsePerceptron = artifacts.require("./classification/SparsePerceptron")

const { convertData } = require('../../src/float-utils-node');


const _toFloat = 1E9

const modelTypes = {
    'dense perceptron': DensePerceptron,
    'naive bayes': NaiveBayesClassifier,
    'nearest centroid classifier': NearestCentroidClassifier,
    'sparse perceptron': SparsePerceptron,
}


async function loadDensePerceptron(model) {

}

async function loadSparsePerceptron(model) {

}

async function loadNearestCentroidClassifier(model, web3, toFloat = _toFloat) {
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
    // TODO Extend centroids if needed.

    gasUsed += (await web3.eth.getTransactionReceipt(classifierContract.transactionHash)).gasUsed
    console.log(`  Deployed classifier to ${classifierContract.address}. gasUsed: ${gasUsed}`)
    // Add classes separately to avoid hitting gasLimit.
    const addClassPromises = []
    for (let i = 1; i < classifications.length; ++i) {
        addClassPromises.push(classifierContract.addClass(
            centroids[i], classifications[i], dataCounts[i]
        ))
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

async function loadNaiveBayes(model) {

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
        case 'nearest centroid classifier':
            return loadNearestCentroidClassifier(model, web3, toFloat)
        case 'sparse perceptron':
            return loadSparsePerceptron(model, web3, toFloat)
        default:
            // Should not happen.
            throw new Error(`Unrecognized model type: "${model.type}"`)
    }
}
