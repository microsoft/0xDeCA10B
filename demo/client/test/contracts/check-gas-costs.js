const fs = require('fs')

const CollaborativeTrainer64 = artifacts.require('./CollaborativeTrainer64')
const DataHandler64 = artifacts.require('./data/DataHandler64')
const Stakeable64 = artifacts.require('./incentive/Stakeable64')
const { deployModel } = require('../../src/ml-models/deploy-model-node')
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

    const classifierInfo = await deployModel(modelPath, web3, toFloat)
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
    const usdPerEth = 266
    const gasPrice = 4E-9
    const usdPerGas = usdPerEth * gasPrice
    const models = [
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580856910-fitness-nb-model.json`,
      //   data: [1, 1, 1, 1, 1, 1, 1, 0, 0],
      //   dataset: 'fitness', modelName: "Naive Bayes",
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580845144-fitness-ncc-model.json`,
      //   data: [1, 1, 1, 1, 1, 1, 1, 0, 0],
      //   normalize: true,
      //   dataset: 'fitness', modelName: "Dense Nearest Centroid",
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580854505-fitness-dense-perceptron-model.json`,
      //   data: [1, 1, 1, 1, 1, 1, 1, 0, 0],
      //   normalize: true,
      //   dataset: 'fitness', modelName: "Dense Perceptron",
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580940061-news-nb-model.json`,
      //   data: [1, 2, 3, 14, 25, 36, 57, 88, 299, 310, 411, 512, 613, 714, 815],
      //   dataset: 'Fake News', modelName: "Naive Bayes",
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580940189-news-ncc-model.json`,
      //   data: [1, 2, 3, 14, 25, 36, 57, 88, 299, 310, 411, 512, 613, 714, 815],
      //   dataset: 'Fake News', modelName: "Sparse Nearest Centroid",
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580940494-news-perceptron-model.json`,
      //   data: [1, 2, 3, 14, 25, 36, 57, 88, 299, 310, 411, 512, 613, 714, 815],
      //   dataset: 'Fake News', modelName: "Sparse Perceptron",
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580943847-imdb-nb-model.json`,
      //   data: [1, 2, 3, 14, 15, 26, 37, 48, 59, 110, 111, 112, 213, 314, 515, 616, 717, 818, 919, 920],
      //   dataset: 'IMDB Reviews', modelName: "Naive Bayes",
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580945025-imdb-ncc-model.json`,
      //   data: [1, 2, 3, 14, 15, 26, 37, 48, 59, 110, 111, 112, 213, 314, 515, 616, 717, 818, 919, 920],
      //   dataset: 'IMDB Reviews', modelName: "Sparse Nearest Centroid",
      // },
      // {
      //   path: `${__dirname}/../../../../simulation/saved_runs/1580945565-imdb-perceptron-model.json`,
      //   data: [1, 2, 3, 14, 15, 26, 37, 48, 59, 110, 111, 112, 213, 314, 515, 616, 717, 818, 919, 920],
      //   dataset: 'IMDB Reviews', modelName: "Sparse Perceptron",
      // },
    ]
    const gasUsages = []
    const tableData = {}
    for (const model of models) {
      if (!fs.existsSync(model.path)) {
        console.debug(`Skipping model path that does not exist: ${model.path}`)
        continue
      }
      console.log(`Checking gas usage for ${model.path}`)
      const gasUsage = {
        model: model.path,
      }
      if (model.dataset) {
        if (tableData[model.dataset] === undefined) {
          tableData[model.dataset] = {}
        }
        tableData[model.dataset][model.modelName] = gasUsage
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
      console.debug("  Adding currently incorrect data using another account...")
      r = await mainInterface.addData(data, 1 - predictedClassification, { from: accounts[1], value: 1E17 })
      console.log(`Adding data (was incorrect) gas used: ${r.receipt.gasUsed}`)
      gasUsage['addIncorrectData'] = r.receipt.gasUsed
      e = r.logs.filter(e => e.event == 'AddData')[0]
      addedTime = e.args.t;
      r = await mainInterface.report(data, 1 - predictedClassification, addedTime, accounts[1])
      gasUsage['report'] = r.receipt.gasUsed
      console.log(`Report gas used: ${r.receipt.gasUsed}`)

      console.log(`gasUsage: ${JSON.stringify(gasUsage, null, 4)}`)
      fs.writeFileSync('gasUsages.json~', JSON.stringify(gasUsages, null, 4))
    }

    // Make tables for LaTeX.
    for (const [dataset, models] of Object.entries(tableData)) {
      console.log(`Table for ${dataset}:`)
      let titleRow = "Action"
      let deploymentRow = "Deployment"
      let updateRow = "Update"
      let refundRow = "Refund"
      let rewardRow = "Reward"
      const minimums = {
        deploy: Math.min(...Object.values(models).map(g => g.deploy)),
        addIncorrectData: Math.min(...Object.values(models).map(g => g.addIncorrectData)),
        refund: Math.min(...Object.values(models).map(g => g.refund)),
        report: Math.min(...Object.values(models).map(g => g.report)),
      }
      for (const [modelName, gasCosts] of Object.entries(models)) {
        titleRow += ` & ${modelName}`
        if (minimums.deploy === gasCosts.deploy) {
          deploymentRow += ` & \\textbf{${gasCosts.deploy.toLocaleString()}} (${(gasCosts.deploy * usdPerGas).toFixed(2)} USD)`
        } else {
          deploymentRow += ` & ${gasCosts.deploy.toLocaleString()}`
        }
        if (minimums.addIncorrectData === gasCosts.addIncorrectData) {
          updateRow += ` & \\textbf{${gasCosts.addIncorrectData.toLocaleString()}} (${(gasCosts.addIncorrectData * usdPerGas).toFixed(2)} USD)`
        } else {
          updateRow += ` & ${gasCosts.addIncorrectData.toLocaleString()}`
        }
        if (minimums.refund === gasCosts.refund) {
          refundRow += ` & \\textbf{${gasCosts.refund.toLocaleString()}} (${(gasCosts.refund * usdPerGas).toFixed(2)} USD)`
        } else {
          refundRow += ` & ${gasCosts.refund.toLocaleString()}`
        }
        if (minimums.report === gasCosts.report) {
          rewardRow += ` & \\textbf{${gasCosts.report.toLocaleString()}} (${(gasCosts.report * usdPerGas).toFixed(2)} USD)`
        } else {
          rewardRow += ` & ${gasCosts.report.toLocaleString()}`
        }
      }
      titleRow += String.raw` \\`
      deploymentRow += String.raw` \\`
      updateRow += String.raw` \\`
      refundRow += String.raw` \\`
      rewardRow += String.raw` \\`
      console.log(`${titleRow}\n${deploymentRow}\n${updateRow}\n${refundRow}\n${rewardRow}\n`)
    }
  })
})
