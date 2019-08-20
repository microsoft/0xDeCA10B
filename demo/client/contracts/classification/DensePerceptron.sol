pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../libs/Math.sol";
import "../libs/SafeMath.sol";
import "../libs/SignedSafeMath.sol";

import {Classifier64} from "./Classifier.sol";

contract DensePerceptron is Classifier64 {

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

    function norm(int64[] memory data) public pure returns (uint result) {
        result = 0;
        for (uint i = 0; i < data.length; ++i) {
            result = result.add(uint(int128(data[i]) * data[i]));
        }
        result = Math.sqrt(result);
    }

    function predict(int64[] memory data) public view returns (uint64) {
        // FIXME
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
        // FIXME
        // Data is binarized (data holds the indices of the features that are present).
        uint64 prediction = predict(data);
        if (prediction != classification) {
            // Update model.
            // predict checks each data[i] >= 0.
            uint i;
            uint len = data.length;
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
}
