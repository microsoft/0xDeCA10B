pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../libs/Math.sol";
import "../libs/SafeMath.sol";
import "../libs/SignedSafeMath.sol";

import {Classifier64} from "./Classifier.sol";

contract DensePerceptron is Classifier64 {

    using SafeMath for uint256;
    using SignedSafeMath for int256;

    int80[] public weights;
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
        // for (uint64 i = 0; i < _weights.length; ++i) {
        //     weights[i] = _weights[i];
        // }
        weights = _weights;
    }

    /**
     * Initialize more weights for the model.
     * Made to be called just after the contract is created and never again.
     * @param _weights The weights to append to the model.
     */
    function initializeWeights(int80[] memory _weights) public onlyOwner {
        for (uint64 i = 0; i < _weights.length; ++i) {
            weights.push(_weights[i]);
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
        int m = intercept;
        require(data.length == weights.length, "The data must have the same dimension as the weights.");
        for (uint i = 0; i < data.length; ++i) {
            m = m.add(int(weights[i]).mul(data[i]));
        }
        if (m <= 0) {
            return 0;
        } else {
            return 1;
        }
    }

    function update(int64[] memory data, uint64 classification) public onlyOwner {
        // TODO Use more SafeMath.
        // TODO Make sure normalized.
        uint64 prediction = predict(data);
        if (prediction != classification) {
            // Update model.
            // predict checks `data.length == weights.length`.
            uint len = data.length;
            if (classification > 0) {
                // sign = 1
                for(uint i = 0; i < len; ++i) {
                    weights[i] += data[i] * learningRate;
                }
            } else {
                // sign = -1
                for(uint i = 0; i < len; ++i) {
                    weights[i] -= data[i] * learningRate;
                }
            }
        }
    }
}
