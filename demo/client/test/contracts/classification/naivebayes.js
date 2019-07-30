const NaiveBayesClassifier = artifacts.require("./classification/NaiveBayesClassifier");

contract('NaiveBayesClassifier', function (accounts) {
  const toFloat = 1E9;

  const vocab = {};
  let vocabLength = 0;
  let classifier;

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
    const smoothingFactor = 1;
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
      return Object.entries(result).map(pair => [web3.utils.toBN(parseInt(pair[0])), web3.utils.toBN(pair[1])]);
    });
    const classCounts = [1, 1];
    const totalNumFeatures = vocabLength;
    classifier = await NaiveBayesClassifier.new(classifications, classCounts, featureCounts, totalNumFeatures, smoothingFactor);
  });

  it("...should predict the classification ALARM", async () => {
    const data = mapFeatures("alarm for 9 am tomorrow");
    console.log(`data: ${JSON.stringify(data)}`);
    const prediction = await classifier.predict(data).then(parseBN);
    assert.equal(prediction, 0);
  });

  it("...should predict the classification WEATHER", async () => {
    const data = mapFeatures("will i need a jacket today");
    console.log(`data: ${JSON.stringify(data)}`);
    const prediction = await classifier.ppredict(data).then(parseBN);
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
