const axios = require('axios');
const fs = require('fs');
const pjson = require('../package.json');

const { convertData } = require('../src/float-utils-node.js');

const CollaborativeTrainer64 = artifacts.require("./CollaborativeTrainer64");
const DataHandler64 = artifacts.require("./data/DataHandler64");
const NearestCentroidClassifier = artifacts.require("./classification/NearestCentroidClassifier");
const Stakeable64 = artifacts.require("./incentive/Stakeable64");

module.exports = function (deployer) {
  if (deployer.network === 'skipMigrations') {
    return;
  }
  // Information to persist to the database.
  const name = "VPA Classifier"
  const description = "Supports multiple domains."
  const encoder = 'universal sentence encoder'
  const modelInfo = {
    name,
    description,
    accuracy: '0.88',
    modelType: 'Classifier64',
    encoder,
  };

  const toFloat = 1E9;

  // Low default times for testing.
  const refundTimeS = 15;
  const anyAddressClaimWaitTimeS = 20;
  const ownerClaimWaitTimeS = 20;
  // Weight for deposit cost in wei.
  const costWeight = 1E15;

  // Model
  const classifications = [];
  const centroids = [];
  const dataCounts = [];
  let model = fs.readFileSync('./src/ml-models/vpa/vpa-classifier-centroids.json', 'utf8');
  model = JSON.parse(model);
  for (let [classification, centroidInfo] of Object.entries(model.intents)) {
    classifications.push(classification);
    centroids.push(convertData(centroidInfo.centroid, web3, toFloat));
    dataCounts.push(centroidInfo.dataCount);
  }

  console.log(`Deploying DataHandler.`);
  return deployer.deploy(DataHandler64).then(dataHandler => {
    console.log(`  Deployed data handler to ${dataHandler.address}.`);
    return deployer.deploy(Stakeable64,
      refundTimeS,
      ownerClaimWaitTimeS,
      anyAddressClaimWaitTimeS,
      costWeight
    ).then(incentiveMechanism => {
      console.log(`  Deployed incentive mechanism to ${incentiveMechanism.address}.`);
      return deployer.deploy(NearestCentroidClassifier,
        [classifications[0]], [centroids[0]], [dataCounts[0]],
        // Block gasLimit by most miners as of May 2019.
        { gas: 8E6 }
      ).then(classifier => {
        // Add classes separately to avoid hitting gasLimit.
        const addClassPromises = [];
        for (let i = 1; i < classifications.length; ++i) {
          addClassPromises.push(classifier.addClass(
            centroids[i], classifications[i], dataCounts[i]
          ));
        }
        console.log(`Deploying main entry point.`);
        return deployer.deploy(CollaborativeTrainer64,
          name, description, encoder,
          dataHandler.address,
          incentiveMechanism.address,
          classifier.address
        ).then(instance => {
          console.log(`  Deployed VPA collaborative classifier to ${instance.address}.`);
          return Promise.all([
            dataHandler.transferOwnership(instance.address),
            incentiveMechanism.transferOwnership(instance.address),
            classifier.transferOwnership(instance.address),
          ].concat(addClassPromises)).then(() => {
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
        });
      });
    });
  });
};
