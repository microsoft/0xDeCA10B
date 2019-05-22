const axios = require('axios');
const fs = require('fs');
const pjson = require('../package.json');

const CollaborativeTrainer64 = artifacts.require("./CollaborativeTrainer64");
const DataHandler64 = artifacts.require("./data/DataHandler64");
const NearestCentroidClassifier = artifacts.require("./classification/NearestCentroidClassifier");
const Stakeable64 = artifacts.require("./incentive/Stakeable64");

module.exports = function (deployer) {
  // Information to persist to the DB.
  const modelInfo = {
    name: "VPA Classifier",
    description: "Supports multiple domains.",
    accuracy: '0.88',
    modelType: 'Classifier64',
    encoder: 'universal sentence encoder',
  };

  const toFloat = 1E9;
  function convertData(data) {
    return data.map(x => Math.round(x * toFloat)).map(web3.utils.toBN);
  }

  // Low default times for testing.
  const refundTimeS = 15;
  const ownerClaimWaitTimeS = 20;
  // Weight for deposit cost in wei.
  const costWeight = 1E15;

  // Model
  const classifications = [];
  const centroids = [];
  const dataCounts = [];
  let model = fs.readFileSync('./src/ml-models/vpa/vpa-classifier-centroids.json', 'utf8');
  model = JSON.parse(model);
  for (let [classification, centroidInfo] of Object.entries(model)) {
    classifications.push(classification);
    centroids.push(convertData(centroidInfo.centroid));
    dataCounts.push(centroidInfo.dataCount);
  }

  console.log(`Deploying DataHandler.`);
  return deployer.deploy(DataHandler64).then(dataHandler => {
    console.log(`  Deployed data handler to ${dataHandler.address}.`);
    return deployer.deploy(Stakeable64,
      refundTimeS,
      ownerClaimWaitTimeS,
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
              console.log("Added model to DB.");
            }).catch(err => {
              if (process.env.CI !== "true") {
                console.error("Error adding model to DB.");
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
