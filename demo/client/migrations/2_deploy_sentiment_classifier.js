const axios = require('axios');
const fs = require('fs');
const pjson = require('../package.json');

const CollaborativeTrainer64 = artifacts.require("./CollaborativeTrainer64");
const DataHandler64 = artifacts.require("./data/DataHandler64");
const Classifier = artifacts.require("./classification/Perceptron");
const Stakeable64 = artifacts.require("./incentive/Stakeable64");

module.exports = async function (deployer) {
  // Information to persist to the DB.
  const modelInfo = {
    name: "IMDB Review Sentiment Classifier",
    description: "A simple IMDB sentiment analysis model.",
    accuracy: '0.829',
    modelType: 'Classifier64',
    encoder: 'IMDB vocab',
  };

  const toFloat = 1E9;
  function convertData(data) {
    return data.map(x => Math.round(x * toFloat)).map(web3.utils.toBN);
  }

  // Low default times for testing.
  const refundTimeS = 15;
  const anyAddressClaimWaitTimeS = 20;
  const ownerClaimWaitTimeS = 20;
  // Weight for deposit cost in wei.
  const costWeight = 1E15;

  const classifications = ["Negative", "Positive"];

  var data = fs.readFileSync('./src/ml-models/imdb-sentiment-model.json', 'utf8');
  var model = JSON.parse(data);

  const weights = convertData(model['coef']);
  const initNumWords = 250;
  const numWordsPerUpdate = 250;

  console.log(`Deploying IMDB model with ${weights.length} weights.`);
  var intercept = web3.utils.toBN(model['intercept'] * toFloat);
  var learningRate = 1;

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
      console.log(`Deploying classifier.`);
      return deployer.deploy(Classifier,
        classifications, weights.slice(0, initNumWords), intercept, learningRate,
        { gas: 7.9E6 }).then(async classifier => {
          console.log(`  Deployed classifier to ${classifier.address}.`);
          for (let i = initNumWords; i < weights.length; i += numWordsPerUpdate) {
            await classifier.initializeWeights(i, weights.slice(i, i + numWordsPerUpdate),
              { gas: 7.9E6 });
            console.log(`  Added weights ${i + numWordsPerUpdate}`);
          }

          console.log(`Deploying collaborative trainer contract.`);
          return deployer.deploy(CollaborativeTrainer64,
            dataHandler.address,
            incentiveMechanism.address,
            classifier.address
          ).then(instance => {
            console.log(`  Deployed IMDB collaborative classifier to ${instance.address}.`);
            return Promise.all([
              dataHandler.transferOwnership(instance.address),
              incentiveMechanism.transferOwnership(instance.address),
              classifier.transferOwnership(instance.address),
            ]).then(() => {
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
