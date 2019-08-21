const axios = require('axios');
const fs = require('fs');
const pjson = require('../package.json');
const { convertNum, convertData } = require('../src/float-utils.js');

const CollaborativeTrainer64 = artifacts.require("./CollaborativeTrainer64");
const DataHandler64 = artifacts.require("./data/DataHandler64");
const DensePerceptron = artifacts.require("./classification/DensePerceptron");
const Stakeable64 = artifacts.require("./incentive/Stakeable64");

module.exports = function (deployer) {
  if (deployer.network === 'skipMigrations') {
    return;
  }
  const toFloat = 1E9;

  // Information to persist to the DB.
  const modelInfo = {
    name: "Hot Dog Classifier",
    description: "Classifies pictures as hot dog or not hot dog.",
    accuracy: '0.64',
    modelType: 'Classifier64',
    encoder: 'MobileNetv2',
  };

  // Low default times for testing.
  const refundTimeS = 15;
  const anyAddressClaimWaitTimeS = 20;
  const ownerClaimWaitTimeS = 20;
  // Weight for deposit cost in wei.
  const costWeight = 1E15;

  const weightChunkSize = 450;

  // Model
  // TODO Get classifications from the model file.
  const classifications = ["HOT DOG", "NOT HOT DOG"];
  let model = fs.readFileSync('./src/ml-models/hot_dog-not/classifier-perceptron.json', 'utf8');
  model = JSON.parse(model);

  const weights = convertData(model['weights'], web3, toFloat);
  const intercept = convertNum(model['bias'], web3, toFloat);
  const learningRate = 1;

  console.log(`Deploying Hot Dog classifier.`);
  // Trick to get await to work:
  deployer.then(async () => {
    const dataHandler = await deployer.deploy(DataHandler64);
    console.log(`  Deployed data handler to ${dataHandler.address}.`);
    const incentiveMechanism = await deployer.deploy(Stakeable64,
      refundTimeS,
      ownerClaimWaitTimeS,
      anyAddressClaimWaitTimeS,
      costWeight);
    console.log(`  Deployed incentive mechanism to ${incentiveMechanism.address}.`);

    console.log(` Deploying classifier with first ${weightChunkSize} weights.`);
    const classifier = await deployer.deploy(DensePerceptron,
      classifications, weights.slice(0, weightChunkSize), intercept, learningRate,
      // Block gasLimit by most miners as of May 2019.
      { gas: 8E6 });

    // Add remaining weights.
    for (let i = weightChunkSize; i < weights.length; i += weightChunkSize) {
      console.log(` Deploying classifier weights [${i}, ${Math.min(i + weightChunkSize, weights.length)}).`);
      await classifier.initializeWeights(weights.slice(i, i + weightChunkSize), { gas: 8E6 });
    }

    console.log(`Deploying main entry point.`);
    const instance = await deployer.deploy(CollaborativeTrainer64,
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
      console.log("Added model to DB.");
    }).catch(err => {
      if (process.env.CI !== "true") {
        console.error("Error adding model to DB.");
        console.error(err);
        throw err;
      }
    });
  });
};
