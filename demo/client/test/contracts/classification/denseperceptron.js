const Classifier = artifacts.require("./classification/DensePerceptron");

const { normalizeArray } = require('../../../src/ml-models/tensor-utils-node');
const { convertData, convertNum } = require('../../../src/float-utils-node');

contract('DensePerceptron', function (accounts) {
  const toFloat = 1E9;

  const classifications = ["NEGATIVE", "POSITIVE"];
  const weights = [0, 1, -1, 0, 0, 0, 0, 1];
  const intercept = _convertNum(0);
  const learningRate = _convertNum(1);

  let classifier;

  function _convertNum(num) {
    return convertNum(num, web3, toFloat);
  }

  function _convertData(data) {
    return convertData(data, web3, toFloat);
  }

  async function normalize(data) {
    const normalizedData = normalizeArray(data);
    return _convertData(normalizedData);
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
    const weightIndexLimit = 5;
    assert.isBelow(weightIndexLimit, weights.length);
    classifier = await Classifier.new(classifications, _convertData(weights.slice(0, weightIndexLimit)), intercept, learningRate);

    await classifier.initializeWeights(_convertData(weights.slice(weightIndexLimit)));

    const retrievedWeights = await Promise.all([...Array(weights.length).keys()].map(i => classifier.weights(i).then(mapBackBN)));
    expect(weights).to.eql(retrievedWeights);
  });

  // Mainly to test gas usage and optimizations.
  it("...should use gas", async () => {
    // Increase `dimensions` to see how much gas could be used.
    // It was using < 8E6 gas with `dimensions = 400`.
    const dimensions = 40;

    const weightChunkSize = 450;
    const bias = 0;
    const _learningRate = _convertNum(1);
    const w = [...Array(dimensions).keys()];
    const c = await Classifier.new(classifications, _convertData(w.slice(0, weightChunkSize)), _convertNum(bias), _learningRate);

    // Add remaining weights.
    for (let i = weightChunkSize; i < w.length; i += weightChunkSize) {
      console.log(` Deploying classifier weights [${i}, ${Math.min(i + weightChunkSize, w.length)}).`);
      await c.initializeWeights(w.slice(i, i + weightChunkSize), { gas: 8E6 });
    }

    // Check gas usage.
    const data = [...Array(dimensions).keys()];
    const normalizedData = await normalize(data);
    const classification = parseBN(await c.predict(normalizedData));
    const updateResponse = await c.update(normalizedData, 1 - classification, { gas: 8E6 });
    // console.log(`updateResponse.receipt.gasUsed: ${updateResponse.receipt.gasUsed}`);
    assert.isBelow(updateResponse.receipt.gasUsed, 8E6, "Too much gas used.");
  })

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
    const classification = parseBN(await classifier.predict(data));
    const _weights = await Promise.all([...Array(data.length).keys()].map(i => classifier.weights(i).then(mapBackBN)));
    let updateResponse = await classifier.update(normalizedData, classification);
    assert.isBelow(updateResponse.receipt.gasUsed, 1E5, "Too much gas used.");
    // console.log(`  update (same class) gasUsed: ${updateResponse.receipt.gasUsed}`);

    let updatedWeights = await Promise.all([...Array(data.length).keys()].map(i => classifier.weights(i).then(mapBackBN)));
    expect(_weights).to.eql(updatedWeights);

    assert.equal(parseBN(await classifier.predict(data)), classification);


    const newClassification = 1 - classification;
    updateResponse = await classifier.update(normalizedData, newClassification);
    assert.isBelow(updateResponse.receipt.gasUsed, 1E5, "Too much gas used.");
    // console.log(`  update (different class) gasUsed: ${updateResponse.receipt.gasUsed}`);

    updatedWeights = await Promise.all([...Array(data.length).keys()].map(i => classifier.weights(i).then(mapBackBN)));
    for (let i = 0; i < normalizedData.length; ++i) {
      let sign = -1;
      if (newClassification > 0) {
        sign = +1;
      }
      _weights[i] += sign * mapBackBN(learningRate) * mapBackBN(normalizedData[i]);
    }
    for (let i = 0; i < _weights.length; ++i) {
      assert.closeTo(updatedWeights[i], _weights[i], 1 / toFloat);
    }

    assert.equal(parseBN(await classifier.predict(data)), newClassification);
  });
});
