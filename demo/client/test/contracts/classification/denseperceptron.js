const Classifier = artifacts.require("./classification/DensePerceptron");

contract('DensePerceptron', function (accounts) {
  const toFloat = 1E9;

  const classifications = ["NEGATIVE", "POSITIVE"];
  const weights = convertData([0, 5, -1]);
  const intercept = web3.utils.toBN(0 * toFloat);
  const learningRate = 1;

  let classifier;

  function convertNum(num) {
    return web3.utils.toBN(Math.round(num * toFloat));
  }

  function parseBN(num) {
    if (web3.utils.isBN(num)) {
      return num.toNumber();
    } else {
      assert.typeOf(num, 'number');
      return num;
    }
  }

  before("deploy classifier", async () => {
    classifier = await Classifier.new(classifications, weights, intercept, learningRate);
  });

  it("...should predict the classification POSITIVE", async () => {
    // TODO
  });

  it("...should predict the classification NEGATIVE", async () => {
    // TODO
  });

  it("...should update", async () => {
    // TODO
  });
});
