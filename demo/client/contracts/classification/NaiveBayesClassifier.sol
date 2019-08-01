pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../libs/Math.sol";
import "../libs/SafeMath.sol";
import "../libs/SignedSafeMath.sol";

import {Classifier64} from "./Classifier.sol";

/**
 * A Multinomial Naive Bayes classifier.
 * Works like in https://scikit-learn.org/stable/modules/naive_bayes.html#multinomial-naive-bayes.
 *
 * The prediction function is not optimized with typical things like working with log-probabilities because:
 * * it is mainly an example,
 * * storing log probabilities would be extra work for the update function which should be very efficient, and
 * * computing log in solidity is not reliable (yet).
 */
contract NaiveBayesClassifier is Classifier64 {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    /** A class has been added. */
    event AddClass(
        /** The name of the class. */
        string name,
        /** The index for the class in the members of this classifier. */
        uint index
    );

    /**
     * Information for a class.
     */
    struct ClassInfo {
        /**
         * The total number of occurrences of all features (sum of featureCounts).
         */
        uint64 totalFeatureCount;
        /**
         * The number of occurrences of a feature.
         */
        mapping(uint32 => uint32) featureCounts;
    }

    ClassInfo[] public classInfos;

    /**
     * The smoothing factor (sometimes called alpha).
     * Use toFloat (1 mapped) for Laplace smoothing.
     */
    uint32 public smoothingFactor;

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
        uint32 _smoothingFactor)
        Classifier64(_classifications) public {
        require(_classifications.length > 0, "At least one class is required.");
        require(_classifications.length < 2 ** 65, "Too many classes given.");
        totalNumFeatures = _totalNumFeatures;
        smoothingFactor = _smoothingFactor;
        classCounts = _classCounts;
        for (uint i = 0; i < _featureCounts.length; ++i){
            ClassInfo memory info = ClassInfo(0);
            uint totalFeatureCount = 0;
            classInfos.push(info);
            ClassInfo storage storedInfo = classInfos[i];
            for (uint j = 0 ; j < _featureCounts[i].length; ++j) {
                storedInfo.featureCounts[_featureCounts[i][j][0]] = _featureCounts[i][j][1];
                totalFeatureCount = totalFeatureCount.add(_featureCounts[i][j][1]);
            }
            require(totalFeatureCount < 2 ** 65, "There are too many features.");
            classInfos[i].totalFeatureCount = uint64(totalFeatureCount);
        }
    }

    // Main overriden methods for training and predicting:

    function addClass(uint classCount, uint32[][] memory featureCounts, string memory classification) public onlyOwner {
        require(classifications.length + 1 < 2 ** 65, "There are too many classes already.");
        classifications.push(classification);
        uint classIndex = classifications.length - 1;
        emit AddClass(classification, classIndex);
        classCounts.push(classCount);
        ClassInfo memory info = ClassInfo(0);
        uint totalFeatureCount = 0;
        classInfos.push(info);
        ClassInfo storage storedInfo = classInfos[classIndex];
        for (uint j = 0 ; j < featureCounts.length; ++j) {
            storedInfo.featureCounts[featureCounts[j][0]] = featureCounts[j][1];
            totalFeatureCount = totalFeatureCount.add(featureCounts[j][1]);
        }
        require(totalFeatureCount < 2 ** 65, "There are too many features.");
        classInfos[classIndex].totalFeatureCount = uint64(totalFeatureCount);
    }

    function norm(int64[] memory /* data */) public pure returns (uint) {
        revert("Normalization is not required.");
    }

    function predict(int64[] memory data) public view returns (uint64 bestClass) {
        // Implementation: simple calculation (no log-probabilities optimization, see contract docs for the reasons)
        bestClass = 0;
        uint maxProb = 0;
        uint denominatorSmoothFactor = uint(smoothingFactor).mul(totalNumFeatures);
        for (uint classIndex = 0; classIndex < classCounts.length; ++classIndex) {
            uint prob = classCounts[classIndex].mul(toFloat);
            ClassInfo storage info = classInfos[classIndex];
            for (uint featureIndex = 0; featureIndex < data.length; ++featureIndex) {
                uint32 featureCount = info.featureCounts[uint32(data[featureIndex])];
                prob = prob.mul(toFloat * featureCount + smoothingFactor).div(toFloat * info.totalFeatureCount + denominatorSmoothFactor);
            }
            if (prob > maxProb) {
                maxProb = prob;
                // There are already checks to make sure there are a limited number of classes.
                bestClass = uint64(classIndex);
            }
        }
    }

    function update(int64[] memory data, uint64 classification) public onlyOwner {
        // Data is binarized (data holds the indices of the features that are present).
        // We could also change this to hold the feature index and counts without changing the interface:
        // each int64 would be split into featureIndex|count and decomposed using bit shift operations.

        require(classification < classifications.length, "Classification is out of bounds.");
        classCounts[classification] = classCounts[classification].add(1);

        ClassInfo storage info = classInfos[classification];

        uint totalFeatureCount = data.length.add(info.totalFeatureCount);
        require(totalFeatureCount < 2 ** 65, "Feature count will be too high.");
        info.totalFeatureCount = uint64(totalFeatureCount);

        for (uint dataIndex = 0; dataIndex < data.length; ++dataIndex) {
            int64 featureIndex = data[dataIndex];
            require(featureIndex < 2 ** 33, "A feature index is too high.");
            require(info.featureCounts[uint32(featureIndex)] < 2 ** 33 - 1, "A feature count in the class would become too high.");
            info.featureCounts[uint32(featureIndex)] += 1;
        }
    }

    // Useful methods to view the underlying data:

    function getClassTotalFeatureCount(uint classIndex) public view returns (uint64) {
        return classInfos[classIndex].totalFeatureCount;
    }

    function getFeatureCount(uint classIndex, uint32 featureIndex) public view returns (uint32) {
        return classInfos[classIndex].featureCounts[featureIndex];
    }
}
