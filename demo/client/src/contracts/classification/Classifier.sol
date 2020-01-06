pragma solidity ^0.5.8;
pragma experimental ABIEncoderV2;

import "../../../lib/SafeMath.sol";
import "../../../lib/SignedSafeMath.sol";

import {Ownable} from "../ownership/Ownable.sol";

/**
 * A classifier that can take a data sample as input and return a predict classification/label for the data.
 */
contract Classifier is Ownable {
    /**
     * The possible classifications that can be predicted.
     * Prediction results are indices to values in this array.
     */
    string[] public classifications;

    /**
     * The indices of the features to use from some well-known shared encoder.
     * If it is empty, then all features are used.
     */
    uint32[] public featureIndices;

    /**
     * Initialize a classifier.
     * @param _classifications The possible classifications that can be predicted.
     */
    constructor(string[] memory _classifications)
    Ownable()
    public {
        classifications = _classifications;
    }

    /**
     * @return The number of possible classifications that can be predicted.
     */
    function getNumClassifications() public view returns (uint) {
        return classifications.length;
    }

    /**
     * Add more feature indices to take from the encoded result.
     * Made to be called just after the contract is created and never again.
     * @param _featureIndices The feature indices to append to the array held by this contract.
     */
    function addFeatureIndices(uint32[] memory _featureIndices) public onlyOwner {
        for (uint32 i = 0; i < _featureIndices.length; ++i) {
            featureIndices.push(_featureIndices[i]);
        }
    }

    /**
     * @return The number of feature indices to use. 0 means to use all feature from the encoding.
     */
    function getNumFeatureIndices() public view returns (uint) {
        return featureIndices.length;
    }
}

/**
 * A `Classifier` for data with 64-bit values.
 */
// Use an abstract contract instead of an interface so that we can enforce internal functions
// and not be forced to have some external.
contract Classifier64 is Classifier {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    /**
     * Number of decimal places precision.
     * Since Solidity does not support floating point numbers,
     * we assume certain numbers have been multiplied by this value.
     */
    uint32 constant public toFloat = 1E9;

    constructor(string[] memory _classifications)
    Classifier(_classifications)
    internal {
        // solium-disable-previous-line no-empty-blocks
    }

    /**
     * @param data A single sample.
     * @return The normalization scalar for `data`.
     */
    function norm(int64[] memory data) public pure returns (uint);

    /**
     * @param data A single sample.
     * @return The predicted classification/label for `data`.
     */
    function predict(int64[] memory data) public view returns (uint64);

    /**
     * Train the classifier with one data sample.
     *
     * @param data The training data or features.
     * @param classification The label for `data`.
     */
    function update(int64[] memory data, uint64 classification) public;
}
