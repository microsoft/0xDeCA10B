pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "../../../lib/Math.sol";

import {Classifier64} from "./Classifier.sol";

/**
 * A Perceptron where the data given for updating and predicting is dense.
 */
contract DensePerceptron is Classifier64 {

    /**
     * The weights for the model.
     * Each multiplied by `toFloat`.
     */
    int80[] public weights;

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

    function norm(int64[] memory data) public override pure returns (uint result) {
        result = 0;
        for (uint i = 0; i < data.length; ++i) {
            result = result.add(uint(int128(data[i]) * data[i]));
        }
        result = Math.sqrt(result);
    }

    function predict(int64[] memory data) public override view returns (uint64) {
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

    function update(int64[] memory data, uint64 classification) public override onlyOwner {
        uint len = data.length;
        require(len == weights.length, "The data must have the same dimension as the weights.");

        // Compute prediction and updates at the same time to save gas.
        // If the model does not need to be updated, then this function should not be called
        // because it will not actually update the state.
        int prediction = intercept;
        int80[] memory newWeights = new int80[](data.length);
        uint _norm = 0;
        if (classification > 0) {
            // sign = 1
            for(uint i = 0; i < len; ++i) {
                int128 datum = data[i];
                int80 w = weights[i];
                prediction = prediction.add(int(w).mul(datum));
                newWeights[i] = w + int80(datum * learningRate / toFloat);
                _norm = _norm.add(uint(datum * datum));
            }
        } else {
            // sign = -1
            for(uint i = 0; i < len; ++i) {
                int128 datum = data[i];
                int80 w = weights[i];
                prediction = prediction.add(int(w).mul(datum));
                newWeights[i] = w - int80(datum * learningRate / toFloat);
                _norm = _norm.add(uint(datum * datum));
            }
        }

        if (prediction <= 0) {
            prediction = 0;
        } else {
            prediction = 1;
        }

        // Must be almost within `toFloat` of `toFloat*toFloat` because we only care about the first `toFloat` digits.
        uint oneSquared = uint(toFloat).mul(toFloat);
        uint offset = uint(toFloat) * 100;
        require(oneSquared - offset < _norm && _norm < oneSquared + offset, "The provided data does not have a norm of 1.");

        if (prediction != classification) {
            weights = newWeights;
        }
    }
}
