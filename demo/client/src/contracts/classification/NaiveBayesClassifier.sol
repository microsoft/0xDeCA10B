pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "../../../lib/Math.sol";

import {Classifier64} from "./Classifier.sol";

/**
 * A Multinomial Naive Bayes classifier.
 * `update` and `predict` methods take `data` that holds the indices of the features that are present.
 * Works like in https://scikit-learn.org/stable/modules/naive_bayes.html#multinomial-naive-bayes.
 *
 * The prediction function is not optimized with typical things like working with log-probabilities because:
 * * it is mainly an example,
 * * storing log probabilities would be extra work for the update function which should be very efficient, and
 * * computing log in solidity is not reliable (yet).
 */
contract NaiveBayesClassifier is Classifier64 {
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
         * The number of samples in the class.
         * We use this instead of class prior probabilities.
         */
        uint64 numSamples;
        /**
         * The total number of occurrences of all features (sum of featureCounts).
         */
        uint64 totalFeatureCount;
        /**
         * The number of occurrences of a feature.
         */
        mapping(uint32 => uint32) featureCounts;
    }

    /**
     * Information for each supported classification.
     */
    ClassInfo[] public classInfos;

    /**
     * The smoothing factor (sometimes called alpha).
     * Use toFloat (1 mapped) for Laplace smoothing.
     */
    uint32 public smoothingFactor;

    /**
     * The total number of features throughout all classes.
     */
    uint totalNumFeatures;

    /**
     * @param _classifications The classifications supported by the model.
     * @param _classCounts The number of occurrences of each class in the training data.
     * @param _featureCounts For each class, the number of times each feature occurs within that class.
     * Each innermost array is a tuple of the feature index and the number of times that feature occurs within the class.
     * @param _totalNumFeatures The total number of features throughout all classes.
     * @param _smoothingFactor The smoothing factor (sometimes called alpha). Use toFloat (1 mapped) for Laplace smoothing.
     */
    constructor(
        string[] memory _classifications,
        uint64[] memory _classCounts,
        uint32[][][] memory _featureCounts,
        uint _totalNumFeatures,
        uint32 _smoothingFactor)
        Classifier64(_classifications) public {
        require(_classifications.length > 0, "At least one class is required.");
        require(_classifications.length < 2 ** 65, "Too many classes given.");
        require(_classifications.length == _classCounts.length, "The number of classifications must match the number of _classCounts.");
        require(_classifications.length == _featureCounts.length, "The number of classifications must match the number of _featureCounts.");
        totalNumFeatures = _totalNumFeatures;
        smoothingFactor = _smoothingFactor;
        for (uint i = 0; i < _featureCounts.length; ++i){
            ClassInfo memory info = ClassInfo(_classCounts[i], 0);
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

    /**
     * Set feature counts for an existing classification.
     * For efficiency, features are overriden them if they have already been set.
     * Made to be called just after the contract is created and never again.
     * @param _featureCounts The number of times each feature occurs.
     * Each innermost array is a tuple of the feature index and the number of times that feature occurs within the class.
     * @param classification The class to add counts to.
     */
    function initializeCounts(uint32[][] memory _featureCounts, uint64 classification) public onlyOwner {
        require(classification < classInfos.length, "This classification has not been added yet.");
        ClassInfo storage classInfo = classInfos[classification];
        uint totalFeatureCount = classInfo.totalFeatureCount;
        for (uint j = 0 ; j < _featureCounts.length; ++j) {
            // Possibly override a feature.
            classInfo.featureCounts[_featureCounts[j][0]] = _featureCounts[j][1];
            totalFeatureCount = totalFeatureCount.add(_featureCounts[j][1]);
        }
        require(totalFeatureCount < 2 ** 65, "There are too many features.");
        classInfo.totalFeatureCount = uint64(totalFeatureCount);
    }

    // Main overriden methods for training and predicting:

    function addClass(uint64 numSamples, uint32[][] memory featureCounts, string memory classification) public onlyOwner {
        require(classifications.length + 1 < 2 ** 65, "There are too many classes already.");
        classifications.push(classification);
        uint classIndex = classifications.length - 1;
        emit AddClass(classification, classIndex);
        ClassInfo memory info = ClassInfo(numSamples, 0);
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

    function norm(int64[] memory /* data */) public override pure returns (uint) {
        revert("Normalization is not required.");
    }

    function predict(int64[] memory data) public override view returns (uint64 bestClass) {
        // Sparse representation: each number in data is a feature index.
        // Implementation: simple calculation (no log-probabilities optimization, see contract docs for the reasons)
        bestClass = 0;
        uint maxProb = 0;
        uint denominatorSmoothFactor = uint(smoothingFactor).mul(totalNumFeatures);
        for (uint classIndex = 0; classIndex < classInfos.length; ++classIndex) {
            ClassInfo storage info = classInfos[classIndex];
            uint prob = uint(info.numSamples).mul(toFloat);
            for (uint featureIndex = 0; featureIndex < data.length; ++featureIndex) {
                uint32 featureCount = info.featureCounts[uint32(data[featureIndex])];
                prob = prob.mul(uint(toFloat) * featureCount + smoothingFactor)
                    .div(uint(toFloat) * info.totalFeatureCount + denominatorSmoothFactor);
            }
            if (prob > maxProb) {
                maxProb = prob;
                // There are already checks to make sure there are a limited number of classes.
                bestClass = uint64(classIndex);
            }
        }
    }

    function update(int64[] memory data, uint64 classification) public override onlyOwner {
        // `data` holds the indices of the features that are present.
        // We could also change this to hold the feature index and counts without changing the interface:
        // each int64 would be split into featureIndex|count and decomposed using bit shift operations.

        require(classification < classifications.length, "Classification is out of bounds.");

        ClassInfo storage info = classInfos[classification];
        require(info.numSamples < 2**64 - 1, "There are too many samples for the class.");
        ++info.numSamples;

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

    function getNumSamples(uint classIndex) public view returns (uint64) {
        return classInfos[classIndex].numSamples;
    }
}
