const Classifier = artifacts.require("./classification/DensePerceptron");

contract('DensePerceptron', function (accounts) {
  const toFloat = 1E9;

  const classifications = ["NEGATIVE", "POSITIVE"];
  const weights = convertData([0, 1, -1, 0, 0, 0, 0, 1]);
  const intercept = web3.utils.toBN(0 * toFloat);
  const learningRate = 1;

  let classifier;

  function convertData(data) {
    return data.map(x => Math.round(x * toFloat)).map(web3.utils.toBN);
  }

  async function normalize(data) {
    data = convertData(data);
    const norm = await classifier.norm(data);
    return data.map(x => x.mul(web3.utils.toBN(toFloat)).div(norm));
  }

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

  async function predict(data) {
    data = await normalize(data);
    return parseBN(await classifier.predict(data));
  }

  before("deploy classifier", async () => {
    classifier = await Classifier.new(classifications, weights, intercept, learningRate);
  });

  it("...should predict the classification POSITIVE", async () => {
    const prediction = await predict([0, 2, 1, 0, 0, 0, 0, 0]);
    assert.equal(prediction, 1, "Wrong classification.");
  });

  it("...should predict the classification NEGATIVE", async () => {

    const prediction = await predict([1, 0, 2, 0, 0, 0, 0, 0])
    assert.equal(prediction, 0, "Wrong classification.");
  });

  it("...should update", async () => {
    const data = [1, 1, 1, 0, 0, 0, 0, 0];
    const classification = await predict(data);
    let updateResponse = await classifier.update(await normalize(data), classification);
    assert.isBelow(updateResponse.receipt.gasUsed, 2E5, "Too much gas used.");
    // console.log(`  update (same class) gasUsed: ${updateResponse.receipt.gasUsed}`);
    assert.equal(await predict(data), classification);

    const newClassification = 1 - classification;
    updateResponse = await classifier.update(await normalize(data), newClassification);
    // console.log(`  update (different class) gasUsed: ${updateResponse.receipt.gasUsed}`);
    assert.equal(await predict(data), newClassification);
  });
});
