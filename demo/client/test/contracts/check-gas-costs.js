const fs = require('fs')

const CollaborativeTrainer64 = artifacts.require("./CollaborativeTrainer64")
const DataHandler64 = artifacts.require("./data/DataHandler64")
const Stakeable64 = artifacts.require("./incentive/Stakeable64")
const { loadModel } = require('../../src/ml-models/load-model-node')
const { convertData } = require('../../src/float-utils-node')

/**
 * This test was mainly created to report gas usage.
 */
contract('CheckGasUsage', function (accounts) {
  const toFloat = 1E9

  async function normalize(classifier, data) {
    data = convertData(data, web3, toFloat);
    return classifier.norm(data).then(norm => {
      return data.map(x => x.mul(web3.utils.toBN(toFloat)).div(norm));
    });
  }

  function parseBN(num) {
    if (web3.utils.isBN(num)) {
      return num.toNumber();
    } else {
      assert.typeOf(num, 'number');
      return num;
    }
  }

  async function initialize(modelPath) {
    let gasUsed = 0
    // Low default times for testing.
    const refundTimeS = ownerClaimWaitTimeS = anyAddressClaimWaitTimeS = 0
    // Weight for deposit cost in wei.
    const costWeight = 1E9

    console.log("  Deploying DataHandler.")
    const dataHandler = await DataHandler64.new()
    gasUsed += (await web3.eth.getTransactionReceipt(dataHandler.transactionHash)).gasUsed
    console.log(`  Deployed data handler to ${dataHandler.address}. Total gasUsed: ${gasUsed}.`)

    const classifierInfo = await loadModel(modelPath, web3, toFloat)
    const classifier = classifierInfo.classifierContract
    gasUsed += classifierInfo.gasUsed
    console.log("  Deploying Incentive Mechanism.")
    const incentiveMechanism = await Stakeable64.new(
      refundTimeS,
      ownerClaimWaitTimeS,
      anyAddressClaimWaitTimeS,
      costWeight
    )
    gasUsed += (await web3.eth.getTransactionReceipt(incentiveMechanism.transactionHash)).gasUsed
    console.log(`  Deployed incentive mechanism to ${incentiveMechanism.address}. Total gasUsed: ${gasUsed}.`)

    const mainInterface = await CollaborativeTrainer64.new(
      "name", "description", "encoder",
      dataHandler.address,
      incentiveMechanism.address,
      classifier.address,
    )
    gasUsed += (await web3.eth.getTransactionReceipt(mainInterface.transactionHash)).gasUsed
    console.log(`  Deployed main interface to ${mainInterface.address}. Total gasUsed: ${gasUsed}.`)
    return Promise.all([
      dataHandler.transferOwnership(mainInterface.address),
      incentiveMechanism.transferOwnership(mainInterface.address),
      classifier.transferOwnership(mainInterface.address),
    ]).then(responses => {
      for (const r of responses) {
        gasUsed += r.receipt.gasUsed
      }
      console.log(`  Transfered ownership to main interface. Total gasUsed: ${gasUsed}.`)
      return {
        classifier,
        mainInterface,
        gasUsed,
      }
    })
  }

  it("...should log gasUsed", async () => {
    const models = [
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580856910-fitness-nb-model.json`,
      //   data: [1, 1, 1, 1, 1, 1, 1, 0, 0],
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580845144-fitness-ncc-model.json`,
      //   data: [1, 1, 1, 1, 1, 1, 1, 0, 0],
      //   normalize: true,
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580854505-fitness-dense-perceptron-model.json`,
      //   data: [1, 1, 1, 1, 1, 1, 1, 0, 0],
      //   normalize: true,
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580940061-news-nb-model.json`,
      //   data: [1, 2, 3, 14, 25, 36, 57, 88, 299, 310, 411, 512, 613, 714, 815],
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580940189-news-ncc-model.json`,
      //   data: [1, 2, 3, 14, 25, 36, 57, 88, 299, 310, 411, 512, 613, 714, 815],
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580940494-news-perceptron-model.json`,
      //   data: [1, 2, 3, 14, 25, 36, 57, 88, 299, 310, 411, 512, 613, 714, 815],
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580943847-imdb-nb-model.json`,
      //   data: [1, 2, 3, 14, 25, 36, 57, 88, 299, 310, 411, 512, 613, 714, 815],
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580945025-imdb-ncc-model.json`,
      //   data: [1, 2, 3, 14, 25, 36, 57, 88, 299, 310, 411, 512, 613, 714, 815],
      // },
      {
        path: `${__dirname}/../../../../simulation/saved_runs/1580945565-imdb-perceptron-model.json`,
        data: [1, 2, 3, 14, 25, 36, 57, 88, 299, 310, 411, 512, 613, 714, 815],
      },
    ]
    const gasUsages = []
    for (const model of models) {
      if (!fs.existsSync(model.path)) {
        console.debug(`Skipping model path that does not exist: ${model.path}`)
        continue
      }
      console.log(`Checking gas usage for ${model.path}`)
      const gasUsage = {
        model: model.path,
      }
      gasUsages.push(gasUsage)
      const mainInterfaceInfo = await initialize(model.path)
      const { classifier, mainInterface } = mainInterfaceInfo
      gasUsage['deploy'] = mainInterfaceInfo.gasUsed
      const data = model.normalize ? (await normalize(classifier, model.data)) : model.data

      // Add with predicted class so that it can be refunded.
      const predictedClassification = parseBN(await classifier.predict(data))
      console.log(`  predictedClassification: ${predictedClassification}`)

      let r = await mainInterface.addData(data, predictedClassification, { from: accounts[0], value: 1E17 })
      let e = r.logs.filter(e => e.event == 'AddData')[0]
      let addedTime = e.args.t;
      gasUsage['addData'] = r.receipt.gasUsed
      console.log(`Adding data gas used: ${r.receipt.gasUsed}`)

      // Refund
      r = await mainInterface.refund(data, predictedClassification, addedTime)
      gasUsage['refund'] = r.receipt.gasUsed
      console.log(`Refund gas used: ${r.receipt.gasUsed}`)

      // Report
      // Someone else adds bad data.
      r = await mainInterface.addData(data, 1 - predictedClassification, { from: accounts[1], value: 1E17 })
      e = r.logs.filter(e => e.event == 'AddData')[0]
      addedTime = e.args.t;
      r = await mainInterface.report(data, 1 - predictedClassification, addedTime, accounts[1])
      gasUsage['report'] = r.receipt.gasUsed
      console.log(`Report gas used: ${r.receipt.gasUsed}`)

      console.log(`gasUsage: ${JSON.stringify(gasUsage, null, 4)}`)
      fs.writeFileSync('gasUsages.json~', JSON.stringify(gasUsages, null, 4))
    }
    console.log(`gasUsages: ${JSON.stringify(gasUsages, null, 4)}`)
  })
})
