const axios = require('axios');
const fs = require('fs');
const pjson = require('../package.json');

const { convertData, convertNum } = require('../src/float-utils-node.js');

const CollaborativeTrainer64 = artifacts.require("./CollaborativeTrainer64");
const DataHandler64 = artifacts.require("./data/DataHandler64");
const DensePerceptron = artifacts.require("./classification/DensePerceptron");
const Stakeable64 = artifacts.require("./incentive/Stakeable64");

module.exports = function (deployer) {
  if (deployer.network === 'skipMigrations') {
    return;
  }
  const toFloat = 1E9;

  // Information to persist to the database.
  const name = "Hot Dog Classifier"
  const description = "Classifies pictures as hot dog or not hot dog."
  const encoder = 'MobileNetv2'
  const modelInfo = {
    name,
    description,
    accuracy: '0.63',
    modelType: 'Classifier64',
    encoder,
  };

  // Low default times for testing.
  const refundTimeWaitTimeS = 15;
  const anyAddressClaimWaitTimeS = 20;
  const ownerClaimWaitTimeS = 20;
  // Weight for deposit cost in wei.
  const costWeight = 1E15;

  const weightChunkSize = 450;

  // Model
  let model = fs.readFileSync('./src/ml-models/hot_dog-not/classifier-perceptron-400.json', 'utf8');
  model = JSON.parse(model);

  const { classifications, featureIndices } = model;
  const weights = convertData(model.weights, web3, toFloat);
  const intercept = convertNum(model.bias, web3, toFloat);
  const learningRate = convertNum(0.5, web3, toFloat);

  console.log(`Deploying Hot Dog classifier.`);
  // Trick to get await to work:
  deployer.then(async () => {
    const dataHandler = await deployer.deploy(DataHandler64);
    console.log(`  Deployed data handler to ${dataHandler.address}.`);
    const incentiveMechanism = await deployer.deploy(Stakeable64,
      refundTimeWaitTimeS,
      ownerClaimWaitTimeS,
      anyAddressClaimWaitTimeS,
      costWeight);
    console.log(`  Deployed incentive mechanism to ${incentiveMechanism.address}.`);

    console.log(` Deploying classifier with first ${Math.min(weights.length, weightChunkSize)} weights.`);
    const classifier = await deployer.deploy(DensePerceptron,
      classifications, weights.slice(0, weightChunkSize), intercept, learningRate,
      // Block gasLimit by most miners as of May 2019.
      { gas: 8E6 });

    // Add remaining weights.
    for (let i = weightChunkSize; i < weights.length; i += weightChunkSize) {
      console.log(` Deploying classifier weights [${i}, ${Math.min(i + weightChunkSize, weights.length)}).`);
      await classifier.initializeWeights(weights.slice(i, i + weightChunkSize));
    }

    // Add feature indices to use.
    if (featureIndices !== undefined) {
      if (featureIndices.length !== weights.length) {
        throw new Error("The number of features must match the number of weights.");
      }
      for (let i = 0; i < featureIndices.length; i += weightChunkSize) {
        console.log(` Deploying classifier feature indices [${i}, ${Math.min(i + weightChunkSize, featureIndices.length)}).`);
        await classifier.addFeatureIndices(featureIndices.slice(i, i + weightChunkSize));
      }
    }

    console.log(`Deploying main entry point.`);
    const instance = await deployer.deploy(CollaborativeTrainer64,
      name, description, encoder,
      dataHandler.address,
      incentiveMechanism.address,
      classifier.address
    );
    console.log(`  Deployed Hot Dog collaborative classifier to ${instance.address}.`);
    await dataHandler.transferOwnership(instance.address);
    await incentiveMechanism.transferOwnership(instance.address);
    await classifier.transferOwnership(instance.address);

    modelInfo.address = instance.address;
    return axios.post(`${pjson.proxy}api/models`, modelInfo).then(() => {
      console.log("Added model to the database.");
    }).catch(err => {
      if (process.env.CI !== "true" && process.env.REACT_APP_ENABLE_SERVICE_DATA_STORE === 'true') {
        console.error("Error adding model to the database.");
        console.error(err);
        throw err;
      }
    });
  });
};
