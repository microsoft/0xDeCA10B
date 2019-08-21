pragma solidity ^0.5.8;
pragma experimental ABIEncoderV2;

import "../libs/SafeMath.sol";
import {Ownable} from "../ownership/Ownable.sol";

/**
 * A classifier that can take a data sample as input and return a predict classification/label for the data.
 */
contract Classifier {
    /**
     * The indices to the possible classifications that can be predicted.
     */
    string[] public classifications;

    /**
     * Initialize a classifier.
     * @param _classifications The possible classifications that can be predicted.
     */
    constructor(string[] memory _classifications) public {
        classifications = _classifications;
    }

    /**
     * @return The number of possible classifications that can be predicted.
     */
    function getNumClassifications() public view returns (uint) {
        return classifications.length;
    }
}


/**
 * A `Classifier` for data with 64-bit values.
 */
// Use an abstract contract instead of an interface so that we can enforce internal functions
// and not be forced to have some external.
contract Classifier64 is Ownable, Classifier {
    // Number decimal places precision.
    uint64 constant public toFloat = 1E9;

    constructor(string[] memory _classifications)
    Ownable()
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
