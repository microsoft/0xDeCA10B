pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "../../../lib/Math.sol";

import {Classifier64} from "./Classifier.sol";

/**
 * A nearest centroid classifier that uses Euclidean distance to predict the closest centroid based on sparse data sample.
 * Data must be sorted indices of features with each feature occurring at most once.
 *
 * https://en.wikipedia.org/wiki/Nearest_centroid_classifier
 */
contract SparseNearestCentroidClassifier is Classifier64 {
    /** A class has been added. */
    event AddClass(
        /** The name of the class. */
        string name,
        /** The index for the class in the members of this classifier. */
        uint index
    );

    uint256 constant public UINT256_MAX = ~uint256(0);

    uint256 constant public dataCountLimit = 2 ** (256 - 64 - 1);

    /**
     * Information for a class.
     */
    struct ClassInfo {
        /**
         * The number of samples in the class.
         */
        uint64 numSamples;

        uint64[] centroid;

        /**
         * The squared 2-norm of the centroid. Multiplied by (toFloat * toFloat).
         */
        uint squaredMagnitude;
    }

    ClassInfo[] public classInfos;

    constructor(
        string[] memory _classifications,
        uint64[][] memory centroids,
        uint64[] memory dataCounts)
        Classifier64(_classifications) public {
        require(centroids.length == _classifications.length, "The number of centroids and classifications must be the same.");
        require(_classifications.length > 0, "At least one class is required.");
        require(_classifications.length < 2 ** 64, "Too many classes given.");
        uint dimensions = centroids[0].length;
        require(dimensions < 2 ** 63, "First centroid is too long.");
        for (uint i = 0; i < centroids.length; ++i) {
            uint64[] memory centroid = centroids[i];
            require(centroid.length == dimensions, "Inconsistent number of dimensions.");
            classInfos.push(ClassInfo(dataCounts[i], centroid, _getSquaredMagnitude(centroid)));
        }
    }

    function _getSquaredMagnitude(uint64[] memory vector) internal pure returns (uint squaredMagnitude) {
        squaredMagnitude = 0;
        for (uint i = 0; i < vector.length; ++i) {
            // Should be safe multiplication and addition because vector entries should be small.
            squaredMagnitude += vector[i] * vector[i];
        }
    }

    /**
     * Extend the number of dimensions of a centroid.
     * Made to be called just after the contract is created and never again.
     * @param extension The values to append to a centroid vector.
     * @param classification The class to add the extension to.
     */
    function extendCentroid(uint64[] memory extension, uint64 classification) public onlyOwner {
        require(classification < classInfos.length, "This classification has not been added yet.");
        ClassInfo storage classInfo = classInfos[classification];
        uint64[] storage centroid = classInfo.centroid;
        require(centroid.length + extension.length < 2 ** 63, "Centroid would be too long.");
        uint squaredMagnitude = classInfo.squaredMagnitude;
        for (uint i = 0; i < extension.length; ++i) {
            centroid.push(extension[i]);
            // Should be safe multiplication and addition because vector entries should be small.
            squaredMagnitude += extension[i] * extension[i];
        }
        classInfo.squaredMagnitude = squaredMagnitude;
    }

    function addClass(uint64[] memory centroid, string memory classification, uint64 dataCount) public onlyOwner {
        require(classifications.length + 1 < 2 ** 64, "There are too many classes already.");
        require(centroid.length == classInfos[0].centroid.length, "Data doesn't have the correct number of dimensions.");
        require(dataCount < dataCountLimit, "Data count is too large.");
        classifications.push(classification);
        classInfos.push(ClassInfo(dataCount, centroid, _getSquaredMagnitude(centroid)));
        emit AddClass(classification, classifications.length - 1);
    }

    function norm(int64[] memory /* data */) public override pure returns (uint) {
        revert("Normalization is not required.");
    }

    function predict(int64[] memory data) public override view returns (uint64 bestClass) {
        // Sparse representation: each number in data is a feature index.
        // Assume values in data are sorted in increasing order.

        uint minDistance = UINT256_MAX;
        bestClass = 0;
        for (uint64 currentClass = 0; currentClass < classInfos.length; ++currentClass) {
            uint64[] storage centroid = classInfos[currentClass].centroid;
            // Default distance for empty data is `squaredMagnitudes[currentClass]`.
            // Well use that as a base and update it.
            // distance = squaredMagnitudes[currentClass]
            // For each j:
            // distance = distance - centroids[currentClass][j]^2 + (centroids[currentClass][j] - toFloat)^2
            // = distance - centroids[currentClass][j]^2 + centroids[currentClass][j]^2 - 2 * centroids[currentClass][j] * toFloat + toFloat^2
            // = distance - 2 * centroids[currentClass][j] * toFloat + toFloat^2
            // = distance + toFloat * (-2 * centroids[currentClass][j] + toFloat)
            int distanceUpdate = 0;

            for (uint dataIndex = 0; dataIndex < data.length; ++dataIndex) {
                // Should be safe since data is not very long.
                distanceUpdate += int(toFloat) - 2 * centroid[uint(data[dataIndex])];
            }

            uint distance = uint(int(classInfos[currentClass].squaredMagnitude) + distanceUpdate * toFloat);

            if (distance < minDistance) {
                minDistance = distance;
                bestClass = currentClass;
            }
        }
    }

    function update(int64[] memory data, uint64 classification) public override onlyOwner {
        require(classification < classInfos.length, "This classification has not been added yet.");
        ClassInfo storage classInfo = classInfos[classification];
        uint64[] memory centroid = classInfo.centroid;
        uint n = classInfos[classification].numSamples;
        uint64 newN;
        // Keep n small enough for multiplication.
        if (n >= dataCountLimit) {
            newN = classInfo.numSamples;
        } else {
            newN = classInfo.numSamples + 1;
            classInfo.numSamples = newN;
        }

        // Could try to optimize further by not updating zero entries in the centroid that are not in the data.
        // This wouldn't help much for our current examples (IMDB + Fake News) since most features occur in all classes.

        // Update centroid using moving average calculation.
        uint squaredMagnitude = 0;
        uint dataIndex = 0;
        for (uint64 featureIndex = 0; featureIndex < centroid.length; ++featureIndex) {
            if (dataIndex < data.length && data[dataIndex] == int64(featureIndex)) {
                // Feature is present.
                uint64 v = uint64((n * centroid[featureIndex] + toFloat) / newN);
                centroid[featureIndex] = v;
                squaredMagnitude = squaredMagnitude.add(uint(v) * v);
                ++dataIndex;
            } else {
                // Feature is not present.
                uint64 v = uint64((n * centroid[featureIndex]) / newN);
                centroid[featureIndex] = v;
                squaredMagnitude = squaredMagnitude.add(uint(v) * v);
            }
        }
        classInfo.centroid = centroid;
        classInfo.squaredMagnitude = squaredMagnitude;
    }

    // Useful methods to view the underlying data:
    function getNumSamples(uint classIndex) public view returns (uint64) {
        return classInfos[classIndex].numSamples;
    }

    function getCentroidValue(uint classIndex, uint featureIndex) public view returns (uint64) {
        return classInfos[classIndex].centroid[featureIndex];
    }

    function getSquaredMagnitude(uint classIndex) public view returns (uint) {
        return classInfos[classIndex].squaredMagnitude;
    }
}
