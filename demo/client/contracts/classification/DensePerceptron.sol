pragma solidity ^0.5.8;
pragma experimental ABIEncoderV2;

import "../libs/Math.sol";
import "../libs/SafeMath.sol";
import "../libs/SignedSafeMath.sol";

import {Classifier64} from "./Classifier.sol";

/**
 * A Perceptron where the data given for updating and predicting is dense.
 */
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
        intercept = _intercept;
        learningRate = _learningRate;

        require(_weights.length < 2**64 - 1, "Too many weights given.");
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
        uint64 prediction = predict(data);
        if (prediction != classification) {
            // Update model.
            // predict checks `data.length == weights.length`.
            uint len = data.length;
            uint _norm = 0;
            int128 datum;
            if (classification > 0) {
                // sign = 1
                for(uint i = 0; i < len; ++i) {
                    datum = data[i];
                    _norm = _norm.add(uint(datum * datum));
                    weights[i] += int80(data[i]) * learningRate;
                }
            } else {
                // sign = -1
                for(uint i = 0; i < len; ++i) {
                    datum = data[i];
                    _norm = _norm.add(uint(datum * datum));
                    weights[i] -= int80(data[i]) * learningRate;
                }
            }

            uint oneSquared = uint(toFloat).mul(toFloat);
            // Must be almost within `toFloat` of `toFloat*toFloat` because we only care about the first `toFloat` digits.
            require(oneSquared - 100 * toFloat < _norm && _norm < oneSquared + 100 * toFloat, "The provided data does not have a norm of 1.");
        }
    }
}
