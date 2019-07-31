const NaiveBayesClassifier = artifacts.require("./classification/NaiveBayesClassifier");

contract('NaiveBayesClassifier', function (accounts) {
  const toFloat = 1E9;

  const smoothingFactor = convertNum(1);
  const classifications = ["ALARM", "WEATHER"];
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

  it("...should update", async () => {
    const newFeature = vocabLength + 10;
    const predictionData = [newFeature];
    assert.equal(await classifier.predict(predictionData).then(parseBN), 0);

    const data = [0, 1, 2, newFeature];
    const classification = 1;
    const prevFeatureCounts = [];
    for (let i in data) {
      const featureIndex = data[i];
      const featureCount = await classifier.getFeatureCount(classification, featureIndex).then(parseBN);
      await prevFeatureCounts.push(featureCount);
    }
    const prevTotalFeatureCount = await classifier.getClassTotalFeatureCount(classification).then(parseBN);

    await classifier.update(data, classification);

    for (let i in prevFeatureCounts) {
      const featureIndex = data[i];
      const featureCount = await classifier.getFeatureCount(classification, featureIndex).then(parseBN);
      assert.equal(featureCount, prevFeatureCounts[i] + 1);
    }

    const totalFeatureCount = await classifier.getClassTotalFeatureCount(classification).then(parseBN);
    assert.equal(totalFeatureCount, prevTotalFeatureCount + data.length);

    assert.equal(await classifier.predict(predictionData).then(parseBN), classification);
  });

  it("...should add class", async () => {
    const classCount = 3;
    const featureCounts = [[0, 2], [1, 3], [6, 5]];
    const classification = "NEW";
    const originalNumClassifications = await classifier.getNumClassifications().then(parseBN);
    classifier.addClass(classCount, featureCounts, classification);
    const newNumClassifications = await classifier.getNumClassifications().then(parseBN);
    assert.equal(newNumClassifications, originalNumClassifications + 1);
    const classIndex = originalNumClassifications;

    assert.equal(await classifier.getClassTotalFeatureCount(classIndex).then(parseBN),
      featureCounts.map(pair => pair[1]).reduce((a, b) => a + b),
      "Total feature count for the new class is wrong.");

    assert.equal(await classifier.getFeatureCount(classIndex, 0).then(parseBN), 2);
    assert.equal(await classifier.getFeatureCount(classIndex, 1).then(parseBN), 3);
    assert.equal(await classifier.getFeatureCount(classIndex, 2).then(parseBN), 0);
    assert.equal(await classifier.getFeatureCount(classIndex, 3).then(parseBN), 0);
    assert.equal(await classifier.getFeatureCount(classIndex, 4).then(parseBN), 0);
    assert.equal(await classifier.getFeatureCount(classIndex, 5).then(parseBN), 0);
    assert.equal(await classifier.getFeatureCount(classIndex, 6).then(parseBN), 5);
    assert.equal(await classifier.getFeatureCount(classIndex, 7).then(parseBN), 0);
    assert.equal(await classifier.getFeatureCount(classIndex, 8).then(parseBN), 0);
    assert.equal(await classifier.getFeatureCount(classIndex, 9).then(parseBN), 0);
    assert.equal(await classifier.getFeatureCount(classIndex, 10).then(parseBN), 0);

    assert.equal(await classifier.predict([0, 1, 6]).then(parseBN), classIndex);
  });
});
