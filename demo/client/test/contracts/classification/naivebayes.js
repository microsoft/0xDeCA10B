const NaiveBayesClassifier = artifacts.require("./classification/NaiveBayesClassifier");

contract('NaiveBayesClassifier', function (accounts) {
  const toFloat = 1E9;

  const vocab = {};
  let vocabLength = 0;
  let classifier;

  function convertNum(num) {
    return web3.utils.toBN(Math.round(num * toFloat));
  }

  function convertData(data) {
    return data.map(convertNum);
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

  function mapFeatures(query) {
    return query.split(" ").map(w => {
      let result = vocab[w];
      if (result === undefined) {
        vocab[w] = result = vocabLength++;
      }
      return result;
    });
  }

  before("deploy classifier", async () => {
    const smoothingFactor = convertNum(1);
    const classifications = ["ALARM", "WEATHER"];
    const queries = [
      "alarm for 11 am tomorrow",
      "will i need a jacket for tomorrow"];
    const featureMappedQueries = queries.map(mapFeatures);
    const featureCounts = featureMappedQueries.map(fv => {
      const result = {};
      fv.forEach(v => {
        if (!(v in result)) {
          result[v] = 0;
        }
        result[v] += 1;
      });
      return Object.entries(result).map(pair => [parseInt(pair[0]), pair[1]].map(web3.utils.toBN));
    });
    const classCounts = [1, 1];
    const totalNumFeatures = vocabLength;
    classifier = await NaiveBayesClassifier.new(classifications, classCounts, featureCounts, totalNumFeatures, smoothingFactor);

    assert.equal(await classifier.getClassTotalFeatureCount(0).then(parseBN), 5,
      "Total feature count for class 0.");
    assert.equal(await classifier.getClassTotalFeatureCount(1).then(parseBN), 7,
      "Total feature count for class 1.");

    for (let featureIndex = 0; featureIndex < 5; ++featureIndex) {
      assert.equal(await classifier.getFeatureCount(0, featureIndex).then(parseBN), 1);
    }
    for (let featureIndex = 5; featureIndex < 11; ++featureIndex) {
      assert.equal(await classifier.getFeatureCount(0, featureIndex).then(parseBN), 0);
    }

    assert.equal(await classifier.getFeatureCount(1, 0).then(parseBN), 0);
    assert.equal(await classifier.getFeatureCount(1, 1).then(parseBN), 1);
    assert.equal(await classifier.getFeatureCount(1, 2).then(parseBN), 0);
    assert.equal(await classifier.getFeatureCount(1, 3).then(parseBN), 0);
    assert.equal(await classifier.getFeatureCount(1, 4).then(parseBN), 1);
    assert.equal(await classifier.getFeatureCount(1, 5).then(parseBN), 1);
    assert.equal(await classifier.getFeatureCount(1, 6).then(parseBN), 1);
    assert.equal(await classifier.getFeatureCount(1, 7).then(parseBN), 1);
    assert.equal(await classifier.getFeatureCount(1, 8).then(parseBN), 1);
    assert.equal(await classifier.getFeatureCount(1, 9).then(parseBN), 1);
    assert.equal(await classifier.getFeatureCount(1, 10).then(parseBN), 0);
  });

  it("...should predict the classification ALARM", async () => {
    const data = mapFeatures("alarm for 9 am tomorrow");
    const prediction = await classifier.predict(data).then(parseBN);
    assert.equal(prediction, 0);
  });

  it("...should predict the classification WEATHER", async () => {
    const data = mapFeatures("will i need a jacket today");
    const prediction = await classifier.predict(data).then(parseBN);
    assert.equal(prediction, 1);
  });

  it("...should predict the classification", async () => {
    // TODO
  });

  it("...should train", async () => {
    // TODO
  });

  it("...should add class", async () => {
    // TODO
  });
});
