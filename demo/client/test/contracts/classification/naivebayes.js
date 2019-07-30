const NaiveBayesClassifier = artifacts.require("./classification/NaiveBayesClassifier");

contract('NaiveBayesClassifier', function (accounts) {
  const toFloat = 1E9;

  const vocab = {};
  let vocabLength = 0;
  let classifier;

  function normalize(data) {
    data = convertData(data);
    return classifier.norm(data).then(norm => {
      return data.map(x => x.mul(web3.utils.toBN(toFloat)).div(norm));
    });
  }

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

  before("deploy classifier", function () {
    const smoothingFactor = 1;
    const classifications = ["ALARM", "WEATHER"];
    const queries = [
      "alarm for 11 am tomorrow",
      "will i need a jacket for tomorrow"];
    const featureMappedQueries = queries.map(q => {
      return q.split(" ").map(w => {
        let result = vocab[w];
        if (result === undefined) {
          vocab[w] = result = vocabLength++;
        }
        return result;
      });
    });
    const featureCounts = featureMappedQueries.map(fv => {
      const result = {};
      fv.forEach(v => {
        if (!(v in result)) {
          result[v] = 0;
        }
        result[v] += 1;
      });
      return Object.entries(result).map(pair => [parseInt(pair[0]), pair[1]]);
    });
    const classCounts = [1, 1];
    const numTrainingSamples = queries.length;
    // TODO
    return NaiveBayesClassifier.new(classifications, classCounts, smoothingFactor).then(c => {
      classifier = c;
    });
  });

  it("...should predict the classification", function () {
    // TODO
  });

  it("...should predict the classification", function () {
    // TODO
  });

  it("...should train", function () {
    // TODO
  });

  it("...should add class", function () {
    // TODO
  });
});
