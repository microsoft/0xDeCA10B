const CollaborativeTrainer64 = artifacts.require("./CollaborativeTrainer64");
const DataHandler64 = artifacts.require("./data/DataHandler64");
const Classifier = artifacts.require("./classification/Perceptron");
const Stakeable64 = artifacts.require("./incentive/Stakeable64");

contract('CollaborativeTrainer with Perceptron', function (accounts) {
  const toFloat = 1E9;

  const refundTimeS = 1;
  const ownerClaimWaitTimeS = 2;
  const anyAddressClaimWaitTimeS = 3;

  const classifications = ["Negative", "Positive"];
  const weights = convertData([0, 5, -1]);
  const intercept = web3.utils.toBN(0 * toFloat);
  const learningRate = 1;

  let dataHandler, incentiveMechanism, classifier, instance;

  function convertData(data) {
    return data.map(x => Math.round(x * toFloat)).map(web3.utils.toBN);
  }

  function parseBN(num) {
    if (web3.utils.isBN(num)) {
      return num.toNumber();
    } else {
      assert.typeOf(num, 'number');
      return num;
    }
  }

  function parseFloatBN(bn) {
    assert(web3.utils.isBN(bn), `${bn} is not a BN`);
    // Can't divide first since a BN can only be an integer.
    return bn.toNumber() / toFloat;
  }

  before("deploy", function () {
    // Weight for deposit cost in wei.
    const costWeight = 1E12;

    console.log(`Deploying DataHandler.`);
    return DataHandler64.new().then(d => {
      dataHandler = d;
      console.log(`  Deployed data handler to ${dataHandler.address}.`);
      return Stakeable64.new(
        refundTimeS,
        ownerClaimWaitTimeS,
        anyAddressClaimWaitTimeS,
        costWeight
      ).then(inc => {
        incentiveMechanism = inc;
        console.log(`  Deployed incentive mechanism to ${incentiveMechanism.address}.`);
        console.log(`Deploying classifier with ${weights.length} weights.`);
        return Classifier.new(classifications, weights, intercept, learningRate).then(m => {
          classifier = m;
          console.log(`  Deployed classifier to ${classifier.address}.`);
          console.log(`Deploying collaborative trainer.`);
          return CollaborativeTrainer64.new(
            dataHandler.address,
            incentiveMechanism.address,
            classifier.address
          ).then(i => {
            instance = i;
            console.log(`  Deployed collaborative trainer to ${i.address}.`);
            return Promise.all([
              dataHandler.transferOwnership(instance.address),
              incentiveMechanism.transferOwnership(instance.address),
              classifier.transferOwnership(instance.address),
            ]);
          });
        });
      });
    });
  });

  it("...should get last update time", function () {
    return incentiveMechanism.lastUpdateTimeS().then(parseBN).then(lastUpdateTimeS => {
      assert.isAtLeast(lastUpdateTimeS, 2);
    });
  });

  it("...should get first weight", function () {
    return classifier.weights(0).then(parseFloatBN).then((firstWeight) => {
      assert.equal(firstWeight, parseFloatBN(weights[0]), `First weight is wrong ${firstWeight} != ${weights[0]}.`);
    });
  });

  it("...should get the classifications", function () {
    const expectedClassifications = classifications;
    return classifier.getNumClassifications().then(numClassifications => {
      assert.equal(numClassifications, expectedClassifications.length, "Number of classifications is wrong.");
      const promises = expectedClassifications.map((expectedClassification, i) => {
        return classifier.classifications(i);
      });
      return Promise.all(promises).then(results => {
        assert.deepEqual(results, expectedClassifications, "Wrong classifications.");
      });
    });
  });

  it("...should predict the classification 0", function () {
    return instance.classifier()
      .then(Classifier.at)
      .then(m => m.predict([2]))
      .then(prediction => {
        assert.equal(prediction, 0, "Wrong classification.");
      });
  });

  it("...should predict the classification 1", function () {
    return instance.classifier()
      .then(Classifier.at)
      .then(m => m.predict([0, 1]))
      .then(prediction => {
        assert.equal(prediction, 1, "Wrong classification.");
      });
  });

  it("...should get the cost", function () {
    return instance.incentiveMechanism()
      .then(Stakeable64.at)
      .then(inc => inc.getNextAddDataCost())
      .then((cost) => {
        assert(cost.gtn(0), "Cost should be positive.");
      });
  });

  it("...should add data", function () {
    return instance.incentiveMechanism()
      .then(Stakeable64.at)
      .then(inc => inc.getNextAddDataCost())
      .then(cost => {
        assert(cost.gtn(0), "Cost should be positive.");
        return instance.addData([0, 1], 0, { from: accounts[0], value: cost }).then((result) => {
          return classifier.weights(0).then(parseFloatBN).then(result => {
            assert.equal(result, parseFloatBN(weights[0]) - learningRate, "First weight is wrong.");
            assert.equal(result, -1, "First weight is wrong.");
          }).then(() => {
            return classifier.weights(1).then(parseFloatBN).then(result => {
              assert.equal(result, parseFloatBN(weights[1]) - learningRate, "Second weight is wrong.");
              assert.equal(result, 4, "Second weight is wrong.");
            });
          }).then(() => {
            return classifier.predict([0]).then((result) => {
              assert.equal(result, 0, "Wrong classification.");
            });
          }).then(() => {
            return classifier.predict([1]).then((result) => {
              assert.equal(result, 1, "Wrong classification.");
            });
          }).then(() => {
            // Pick a large number.
            var weightsLength = 2 ** 20;
            var data = [];
            var requiredSampleLength = 60;
            var sample1 = Array(requiredSampleLength).fill(weightsLength + 1, 0);
            sample1[0] = 0;
            var sample2 = Array(requiredSampleLength).fill(weightsLength + 1, 0);
            sample2[0] = 1;
            var data = [sample1, sample2];
            return classifier.evaluateBatch(data, [0, 1]).then(result => {
              assert.equal(result, 2, "Wrong number correct.");
            });
          });
        });
      });
  });

  it("...should not refund", function () {
    return instance.refund([0, 2], 1, 3).then(() => {
      assert.fail("Shouldn't be allowed to refund.");
    }).catch(err => {
      // We can't test the error message yet.
      assert.equal(err, "Error: Returned error: VM Exception while processing transaction: revert Data not found. -- Reason given: Data not found..")
    });
  });

  it("...should refund", function (done) {
    assert.isAtLeast(accounts.length, 2, "At least 2 accounts are required.");
    var contributor = accounts[0];
    var badContributor = accounts[1];

    instance.incentiveMechanism()
      .then(Stakeable64.at)
      .then(inc => inc.getNextAddDataCost()).then((maxCost) => {
        return web3.eth.getBalance(contributor).then(balanceBeforeAdd => {
          balanceBeforeAdd = web3.utils.toBN(balanceBeforeAdd);
          // contributor adds good data so that they can get a refund and take someone else's deposit later.

          return instance.addData([0, 1], 1, { from: contributor, value: maxCost }).then((result) => {
            var addedTime = new Date().getTime();

            var e = result.logs.filter(e => e.event == 'AddData')[0];
            assert.exists(e, "AddData event not found.");
            var time = e.args.t;
            var cost = e.args.cost;
            assert(web3.utils.isBN(cost));
            assert(cost.lte(maxCost));
            return web3.eth.getBalance(contributor).then(balanceAfterAdd => {
              balanceAfterAdd = web3.utils.toBN(balanceAfterAdd);
              // Ideally balanceAfterAdd = balanceBeforeAdd - cost
              // but because of transaction fees:
              // balanceAfterAdd = balanceBeforeAdd - cost - fee < balanceBeforeAdd - cost
              // balanceAfterAdd < balanceBeforeAdd - cost
              assert(balanceAfterAdd.lte(balanceBeforeAdd.sub(cost)));

              // badContributor adds bad data.
              return instance.incentiveMechanism()
                .then(Stakeable64.at)
                .then(inc => inc.getNextAddDataCost())
                .then((result) => {
                  var badAddCost = result;
                  return instance.addData([0, 1], 0, { from: badContributor, value: badAddCost }).then((result) => {
                    const badAddedTime = new Date().getTime();

                    var e = result.logs.filter(e => e.event == 'AddData')[0];
                    assert.exists(e, "AddData event not found.");
                    var badTime = e.args.t;
                    setTimeout(_ => {
                      return instance.refund([0, 1], 1, time, { from: contributor }).then(result => {
                        return web3.eth.getBalance(contributor).then(balanceAfterRefund => {
                          balanceAfterRefund = web3.utils.toBN(balanceAfterRefund);
                          // Ideally balanceAfterRefund = balanceAfterAdd + cost
                          // but because of transaction fees:
                          // balanceAfterRefund < balanceAfterAdd + cost
                          assert(balanceAfterRefund.lte(balanceAfterAdd.add(cost)));

                          // Ideally balanceAfterRefund > balanceAfterAdd
                          // but we can't be sure because of transaction fees.

                          return dataHandler.getClaimableAmount([0, 1], 1, time, contributor).then(result => {
                            assert.equal(result, 0);
                            return dataHandler.hasClaimed([0, 1], 1, time, contributor, contributor).then(hasClaimed => {
                              assert.equal(hasClaimed, true);

                              // Now that good data has been verified, badContributor's deposit can be taken.
                              setTimeout(_ => {
                                return instance.report([0, 1], 0, badTime, badContributor).then(_ => {
                                  return dataHandler.getClaimableAmount([0, 1], 0, badTime, badContributor).then(result => {
                                    assert.equal(result, 0);
                                    return dataHandler.hasClaimed([0, 1], 0, badTime, badContributor, contributor).then(hasClaimed => {
                                      assert.equal(hasClaimed, true);
                                      done();
                                    });
                                  });
                                });
                              },
                                // Delay enough time to allow a refund.
                                refundTimeS * 1000 - (new Date().getTime() - badAddedTime));
                            });
                          });
                        });
                      });
                    },
                      // Delay enough time to allow a refund.
                      refundTimeS * 1000 - (new Date().getTime() - addedTime));
                  });
                });
            });
          });
        });
      });
  });
});
