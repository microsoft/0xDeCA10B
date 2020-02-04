const fs = require('fs')

const DensePerceptron = artifacts.require("./classification/DensePerceptron")
const NaiveBayesClassifier = artifacts.require("./classification/")
const NearestCentroidClassifier = artifacts.require("./classification/NearestCentroidClassifier")
const SparsePerceptron = artifacts.require("./classification/SparsePerceptron")

const { convertData } = require('../../src/float-utils-node');

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

async function loadNearestCentroidClassifier(model) {
    const classifications = [];
    const centroids = [];
    const dataCounts = [];
    console.log(`Deploying VPA classifier for tests.`);
    let model = fs.readFileSync('./src/ml-models/vpa/vpa-classifier-centroids.json', 'utf8');
    model = JSON.parse(model);
    for (let [classification, centroidInfo] of Object.entries(model)) {
        classifications.push(classification);
        // To test gas usage faster, use less dimensions:
        // centroidInfo.centroid = centroidInfo.centroid.slice(0, 64);
        centroids.push(convertData(centroidInfo.centroid, web3, toFloat));
        dataCounts.push(centroidInfo.dataCount);
        if (numDimensions === null) {
            numDimensions = centroidInfo.centroid.length;
        } else {
            assert.equal(centroidInfo.centroid.length, numDimensions);
        }
    }

    const classifier = await NearestCentroidClassifier.new(
        [classifications[0]], [centroids[0]], [dataCounts[0]],
        // Block gasLimit by most miners as of May 2019.
        { gas: 8E6 }
    );
    console.log(`  Deployed classifier to ${classifier.address}.`);
    // Add classes separately to avoid hitting gasLimit.
    const addClassPromises = [];
    for (let i = 1; i < classifications.length; ++i) {
        addClassPromises.push(classifier.addClass(
            centroids[i], classifications[i], dataCounts[i]
        ));
    }
    console.log(`  Deploying main entry point.`);
    instance = await CollaborativeTrainer64.new(
        "name", "description", "encoder",
        dataHandler.address,
        incentiveMechanism.address,
        classifier.address
    );
    console.log(`  Deployed VPA collaborative classifier to ${instance.address}.`);
    await Promise.all(addClassPromises).then(() => {
        console.log("  All classes added.")
    });
    return classifier
}

async function loadNaiveBayes(model) {

}

/**
 * @returns The contract for the model, an instance of `Classifier64`.
 */
exports.loadModel = async function (path) {
    let model = fs.readFileSync(path, 'utf8')
    // TODO
    model = JSON.parse(model)
}
