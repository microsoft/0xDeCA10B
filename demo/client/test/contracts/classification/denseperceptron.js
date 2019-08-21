const Classifier = artifacts.require("./classification/DensePerceptron");

contract('DensePerceptron', function (accounts) {
  const toFloat = 1E9;

  const classifications = ["NEGATIVE", "POSITIVE"];
  const weights = [0, 1, -1, 0, 0, 0, 0, 1];
  const intercept = convertNum(0);
  const learningRate = 1;

  let classifier;

  function convertNum(num) {
    return web3.utils.toBN(Math.round(num * toFloat));
  }

  function convertData(data) {
    return data.map(convertNum);
  }

  async function normalize(data) {
    data = convertData(data);
    const norm = await classifier.norm(data);
    return data.map(x => x.mul(web3.utils.toBN(toFloat)).div(norm));
  }

  function parseBN(num) {
    if (web3.utils.isBN(num)) {
      return num.toNumber();
    } else {
      assert.typeOf(num, 'number');
      return num;
    }
  }

  function mapBackBN(num) {
    return parseBN(num) / toFloat;
  }

  async function predict(data) {
    data = await normalize(data);
    return parseBN(await classifier.predict(data));
  }

  before("deploy classifier", async () => {
    classifier = await Classifier.new(classifications, convertData(weights), intercept, learningRate);

    const retrievedWeights = await Promise.all([...Array(weights.length).keys()].map(i => classifier.weights(i).then(mapBackBN)));
    expect(weights).to.eql(retrievedWeights);
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
    const normalizedData = await normalize(data);
    const classification = await predict(normalizedData);
    const _weights = await Promise.all([...Array(data.length).keys()].map(i => classifier.weights(i).then(mapBackBN)));
    let updateResponse = await classifier.update(normalizedData, classification);
    assert.isBelow(updateResponse.receipt.gasUsed, 2E5, "Too much gas used.");
    // console.log(`  update (same class) gasUsed: ${updateResponse.receipt.gasUsed}`);

    let updatedWeights = await Promise.all([...Array(data.length).keys()].map(i => classifier.weights(i).then(mapBackBN)));
    expect(_weights).to.eql(updatedWeights);

    assert.equal(await predict(normalizedData), classification);


    const newClassification = 1 - classification;
    updateResponse = await classifier.update(await normalize(data), newClassification);
    // console.log(`  update (different class) gasUsed: ${updateResponse.receipt.gasUsed}`);

    updatedWeights = await Promise.all([...Array(data.length).keys()].map(i => classifier.weights(i).then(mapBackBN)));
    for (let i = 0; i < normalizedData.length; ++i) {
      let sign = -1;
      if (newClassification > 0) {
        sign = +1;
      }
      _weights[i] += sign * learningRate * mapBackBN(normalizedData[i]);
    }
    expect(_weights).to.eql(updatedWeights);

    // FIXME Handle decimal accuracy.
    assert.equal(await predict(normalizedData), newClassification);
  });
});
