pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import {Classifier64} from "./Classifier.sol";

/**
 * A Perceptron where the data given for updating and predicting is sparse.
 * `update` and `predict` methods take `data` that holds the indices of the features that are present.
 */
contract SparsePerceptron is Classifier64 {

    /**
     * The weights for the model.
     * Multiplied by `toFloat`.
     */
    mapping(uint64 => int80) public weights;

    /**
     * The bias to add to the multiplication of the weights and the data.
     * Multiplied by `toFloat`.
     */
    int80 public intercept;

    /**
     * The amount of impact that new training data has to the weights.
     * Multiplied by `toFloat`.
     */
    uint32 public learningRate;

    /**
     * @param _classifications The classifications supported by the model.
     * @param _weights The weights for the model. Each multiplied by `toFloat`.
     * @param _intercept The bias to add to the multiplication of the weights and the data. Multiplied by `toFloat`.
     * @param _learningRate (Optional, defaults to 1). The amount of impact that new training data has to the weights.
     Multiplied by `toFloat`.
     */
    constructor(
        string[] memory _classifications,
        int80[] memory _weights,
        int80 _intercept,
        uint32 _learningRate
    ) Classifier64(_classifications) public {
        intercept = _intercept;
        learningRate = _learningRate;

        require(_weights.length < 2**64 - 1, "Too many weights given.");
        for (uint64 i = 0; i < _weights.length; ++i) {
            weights[i] = _weights[i];
        }
    }

    /**
     * Initialize weights for the model.
     * Made to be called just after the contract is created and never again.
     * @param startIndex The index to start placing `_weights` into the model's weights.
     * @param _weights The weights to set for the model.
     */
    function initializeWeights(uint64 startIndex, int80[] memory _weights) public onlyOwner {
        for (uint64 i = 0; i < _weights.length; ++i) {
            weights[startIndex + i] = _weights[i];
        }
    }

    /**
     * Initialize sparse weights for the model.
     * Made to be called just after the contract is created and never again.
     * @param _weights A sparse representation of the weights.
     * Each innermost array is a tuple of the feature index and the weight for that feature.
     */
    function initializeSparseWeights(int80[][] memory _weights) public onlyOwner {
        for (uint i = 0; i < _weights.length; ++i) {
            int80 featureIndex = _weights[i][0];
            require(featureIndex < 2 ** 64, "A feature index is too large.");
            weights[uint64(featureIndex)] = _weights[i][1];
        }
    }

    function norm(int64[] memory /* data */) public override pure returns (uint) {
        revert("Normalization is not required.");
    }

    function predict(int64[] memory data) public override view returns (uint64) {
        int m = intercept;
        for (uint i = 0; i < data.length; ++i) {
            // `update` assumes this check is done.
            require(data[i] >= 0, "Not all indices are >= 0.");
            m = m.add(weights[uint64(data[i])]);
        }
        if (m <= 0) {
            return 0;
        } else {
            return 1;
        }
    }

    function update(int64[] memory data, uint64 classification) public override onlyOwner {
        // `data` holds the indices of the features that are present.
        uint64 prediction = predict(data);
        if (prediction != classification) {
            // Update model.
            // predict checks each data[i] >= 0.
            uint i;
            uint len = data.length;
            if (classification > 0) {
                // sign = 1
                for(i = 0; i < len; ++i) {
                    weights[uint64(data[i])] += learningRate;
                }
            } else {
                // sign = -1
                for(i = 0; i < len; ++i) {
                    weights[uint64(data[i])] -= learningRate;
                }
            }
        }
    }

    /**
     * Evaluate a batch.
     *
     * Force samples to have a size of 60 because about 78% of the IMDB test data has less than 60 tokens. If the sample has less than 60 unique tokens, then use a value > weights.length.
     *
     * @return numCorrect The number correct in the batch.
     */
    function evaluateBatch(uint24[60][] calldata dataBatch, uint64[] calldata _classifications) external view returns (uint numCorrect) {
        numCorrect = 0;
        uint len = dataBatch.length;
        uint i;
        uint dataLen;
        uint24[60] memory data;
        int80 prediction;
        for (uint dataIndex = 0; dataIndex < len; ++dataIndex) {
            data = dataBatch[dataIndex];
            // Re-implement prediction for speed and to handle the type of data not matching.
            prediction = intercept;
            dataLen = data.length;
            for (i = 0; i < dataLen; ++i) {
                prediction += weights[data[i]];
            }
            if (prediction <= 0) {
                prediction = 0;
            } else {
                prediction = 1;
            }

            if (prediction == _classifications[dataIndex]) {
                numCorrect += 1;
            }
        }
    }
}
