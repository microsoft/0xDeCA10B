pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../libs/SafeMath.sol";
import "../libs/SignedSafeMath.sol";

import {Classifier64} from "./Classifier.sol";

contract Perceptron is Classifier64 {

    using SafeMath for uint256;
    using SignedSafeMath for int256;

    mapping(uint64 => int80) public weights;
    int80 public intercept;
    uint8 public learningRate;

    constructor(
        string[] memory _classifications,
        int80[] memory _weights,
        int80 _intercept,
        uint8 _learningRate
    ) Classifier64(_classifications) public {
        require(_learningRate > 0, "The learning rate must be > 0.");

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

    function norm(int64[] memory /* data */) public pure returns (uint) {
        revert("Normalization is not required.");
    }

    function predict(int64[] memory data) public view returns (uint64) {
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

    function update(int64[] memory data, uint64 classification) public onlyOwner {
        uint64 prediction = predict(data);
        if (prediction != classification) {
            // Update model.
            // predict checks each data[i] >= 0.
            uint i;
            uint len = data.length;
            // Data is binarized.
            int80 change = toFloat * learningRate;
            if (classification > 0) {
                // sign = 1
                for(i = 0; i < len; ++i) {
                    weights[uint64(data[i])] += change;
                }
            } else {
                // sign = -1
                for(i = 0; i < len; ++i) {
                    weights[uint64(data[i])] -= change;
                }
            }
        }
    }

    /**
     * Evaluate a batch.
     *
     * Force samples to have a size of 60 because about 78% of the IMDB test data has less than 60 tokens. If the sample has less than 60 unique tokens, then use a value > weights.length.
     *
     * @return The number correct in the batch.
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
