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

    /**
     * Information for a class.
     */
    struct ClassInfo {
        /**
         * The total number of occurrences of all features (sum of featureCounts).
         */
        uint totalFeatureCount;
        /**
         * The number of occurrences of a feature.
         */
        mapping(uint32 => uint32) featureCounts;
    }

    ClassInfo[] public classInfos;

    uint public smoothingFactor;

    /**
     * The number of samples in each class.
     * We use this instead of class prior probabilities.
     * Scaled by toFloat.
     */
    uint[] public classCounts;

    /**
     * The total number of features throughout all classes.
     */
    uint totalNumFeatures;

    constructor(
        string[] memory _classifications,
        uint[] memory _classCounts,
        uint32[][][] memory _featureCounts,
        uint _totalNumFeatures,
        uint _smoothingFactor)
        Classifier64(_classifications) public {
        require(_classifications.length > 0, "At least one class is required.");
        require(_classifications.length < 2 ** 64, "Too many classes given.");
        totalNumFeatures = _totalNumFeatures;
        smoothingFactor = _smoothingFactor;
        classCounts = new uint[](_classCounts.length);
        for (uint i = 0; i < _classCounts.length; ++i) {
            classCounts[i] = _classCounts[i].mul(toFloat);
        }
        for (uint i = 0; i < _featureCounts.length; ++i){
            uint totalFeatureCount = 0;
            ClassInfo memory info = ClassInfo(totalFeatureCount);
            classInfos.push(info);
            ClassInfo storage storedInfo = classInfos[i];
            for (uint j = 0 ; j < _featureCounts[i].length; ++j) {
                storedInfo.featureCounts[_featureCounts[i][j][0]] = _featureCounts[i][j][1];
                totalFeatureCount = totalFeatureCount.add(_featureCounts[i][j][1]);
            }
            classInfos[i].totalFeatureCount = totalFeatureCount;
        }
    }

    // Main overriden methods for training and predicting:

    function addClass(int64[] memory centroid, string memory classification, uint dataCount) public onlyOwner {
        require(classifications.length + 1 < 2 ** 64, "There are too many classes already.");
        // TODO
    }

    function norm(int64[] memory /* data */) public pure returns (uint) {
        revert("Normalization is not required.");
    }

    function predict(int64[] memory data) public view returns (uint64 bestClass) {
        bestClass = 0;
        uint maxProb = 0;
        uint denominatorSmoothFactor = smoothingFactor.mul(totalNumFeatures);
        for (uint classIndex = 0; classIndex < classCounts.length; ++classIndex) {
            uint prob = classCounts[classIndex];
            ClassInfo storage info = classInfos[classIndex];
            for (uint featureIndex = 0; featureIndex < data.length; ++featureIndex) {
                uint32 featureCount = info.featureCounts[uint32(data[featureIndex])];
                // FIXME Handle scalled smoothingFactor so that we can handle with smoothingFactor<1.
                prob = prob.mul(featureCount + smoothingFactor).div(info.totalFeatureCount + denominatorSmoothFactor);
            }
            if (prob > maxProb) {
                maxProb = prob;
                // There are already checks to make sure there are a limited number of classes.
                bestClass = uint64(classIndex);
            }
        }
    }

    function update(int64[] memory data, uint64 classification) public onlyOwner {
        require(classification < classifications.length, "Classification is out of bounds.");
        
    }

    // Useful methods to view the underlying data:

    function getClassTotalFeatureCount(uint classIndex) public view returns (uint) {
        return classInfos[classIndex].totalFeatureCount;
    }

    function getFeatureCount(uint classIndex, uint32 featureIndex) public view returns (uint32) {
        return classInfos[classIndex].featureCounts[featureIndex];
    }
}
