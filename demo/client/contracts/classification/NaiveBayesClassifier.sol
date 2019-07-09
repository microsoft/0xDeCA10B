pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../libs/Math.sol";
import "../libs/SafeMath.sol";
import "../libs/SignedSafeMath.sol";

import {Classifier64} from "./Classifier.sol";

/**
 * A Multinomial Naive Bayes classifier.
 * Works like in https://scikit-learn.org/stable/modules/naive_bayes.html#multinomial-naive-bayes.
 */
contract NaiveBayesClassifier is Classifier64 {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    uint256 constant public dataCountLimit = 2 ** (256 - 64 - 1);

    /**
     * The number of samples for each class.
     */
    uint[] public dataCounts;

    constructor(
        string[] memory _classifications,
        uint[] memory _dataCounts)
        Classifier64(_classifications) public {
        require(_classifications.length > 0, "At least one class is required.");
        require(_classifications.length < 2 ** 64, "Too many classes given.");
        dataCounts = _dataCounts;
    }

    function addClass(int64[] memory centroid, string memory classification, uint dataCount) public onlyOwner {
        require(classifications.length + 1 < 2 ** 64, "There are too many classes already.");
        // TODO
    }

    function norm(int64[] memory /* data */) public pure returns (uint) {
        revert("Normalization is not required.");
    }

    function predict(int64[] memory data) public view returns (uint64 bestClass) {
        // TODO
    }

    function update(int64[] memory data, uint64 classification) public onlyOwner {
        require(classification < classifications.length, "Classification is out of bounds.");
        // TODO
    }
}
