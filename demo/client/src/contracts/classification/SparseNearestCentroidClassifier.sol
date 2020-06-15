pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "../../../lib/Math.sol";

import {Classifier64} from "./Classifier.sol";

/**
 * A nearest centroid classifier that uses Euclidean distance to predict the closest centroid based on a sparse data sample.
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

        /**
         * The squared 2-norm of the centroid. Multiplied by `(toFloat * toFloat)`.
         */
        uint squaredMagnitude;

        /**
         * The average of all data points in the class. Values are each multiplied by `toFloat`.
         */
        mapping(uint32 => uint64) centroid;
    }

    /**
     * Information for each supported classification.
     */
    ClassInfo[] public classInfos;

    constructor(
        string[] memory _classifications,
        uint64[][][] memory _centroids,
        uint64[] memory dataCounts)
        Classifier64(_classifications) public {
        require(_centroids.length == _classifications.length, "The number of centroids and classifications must be the same.");
        require(_classifications.length > 0, "At least one class is required.");
        require(_classifications.length < 2 ** 64, "Too many classes given.");
        for (uint i = 0; i < _centroids.length; ++i) {
            uint squaredMagnitude = 0;
            classInfos.push(ClassInfo(dataCounts[i], squaredMagnitude));
            ClassInfo storage storedInfo = classInfos[i];
            for (uint j = 0; j < _centroids[i].length; ++j) {
                storedInfo.centroid[uint32(_centroids[i][j][0])] = _centroids[i][j][1];
                // Should be safe multiplication and addition because vector entries should be small.
                squaredMagnitude += uint(_centroids[i][j][1]) * _centroids[i][j][1];
            }
            storedInfo.squaredMagnitude = squaredMagnitude;
        }
    }

    /**
     * Extend the number of dimensions of a centroid.
     * Made to be called just after the contract is created and never again.
     * @param extension The values to append to a centroid vector.
     * @param classification The class to add the extension to.
     */
    function extendCentroid(uint64[][] memory extension, uint64 classification) public onlyOwner {
        require(classification < classInfos.length, "This classification has not been added yet.");
        ClassInfo storage classInfo = classInfos[classification];
        mapping(uint32 => uint64) storage centroid = classInfo.centroid;
        uint squaredMagnitude = classInfo.squaredMagnitude;
        for (uint i = 0; i < extension.length; ++i) {
            centroid[uint32(extension[i][0])] = extension[i][1];
            // Should be safe multiplication and addition because vector entries should be small.
            squaredMagnitude += uint(extension[i][1]) * extension[i][1];
        }
        classInfo.squaredMagnitude = squaredMagnitude;
    }

    function addClass(uint64[][] memory centroid, string memory classification, uint64 dataCount) public onlyOwner {
        require(classifications.length + 1 < 2 ** 64, "There are too many classes already.");
        require(dataCount < dataCountLimit, "Data count is too large.");
        uint squaredMagnitude = 0;
        classInfos.push(ClassInfo(dataCount, squaredMagnitude));
        ClassInfo storage storedInfo = classInfos[classInfos.length - 1];
        classifications.push(classification);
        for (uint i = 0; i < centroid.length; ++i) {
            storedInfo.centroid[uint32(centroid[i][0])] = centroid[i][1];
            // Should be safe multiplication and addition because vector entries should be small.
            squaredMagnitude += uint(centroid[i][1]) * centroid[i][1];
        }
        storedInfo.squaredMagnitude = squaredMagnitude;

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
            mapping(uint32 => uint64) storage centroid = classInfos[currentClass].centroid;
            // Default distance for empty data is `classInfos[currentClass].squaredMagnitude`.
            // Well use that as a base and update it.
            // distance = classInfos[currentClass].squaredMagnitude
            // For each j:
            // distance = distance - centroid[j]^2 + (centroid[j] - toFloat)^2
            // = distance - centroid[j]^2 + centroid[j]^2 - 2 * centroid[j] * toFloat + toFloat^2
            // = distance - 2 * centroid[j] * toFloat + toFloat^2
            // = distance + toFloat * (-2 * centroid[j] + toFloat)
            int distanceUpdate = 0;

            for (uint dataIndex = 0; dataIndex < data.length; ++dataIndex) {
                // Should be safe since data is not very long.
                distanceUpdate += int(toFloat) - 2 * centroid[uint32(data[dataIndex])];
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
        mapping(uint32 => uint64) storage centroid = classInfo.centroid;
        uint n = classInfos[classification].numSamples;
        uint64 newN;
        // Keep n small enough for multiplication.
        if (n >= dataCountLimit) {
            newN = classInfo.numSamples;
        } else {
            newN = classInfo.numSamples + 1;
            classInfo.numSamples = newN;
        }

        uint squaredMagnitude = classInfo.squaredMagnitude;

        // Update centroid using moving average calculation.
        for (uint dataIndex = 0; dataIndex < data.length; ++dataIndex) {
            uint32 featureIndex = uint32(data[dataIndex]);
            squaredMagnitude = squaredMagnitude.sub(uint(centroid[featureIndex]) * centroid[featureIndex]);
            uint64 v = uint64((n * centroid[featureIndex] + toFloat) / newN);
            centroid[featureIndex] = v;
            squaredMagnitude = squaredMagnitude.add(uint(v) * v);
        }

        classInfo.squaredMagnitude = squaredMagnitude;
    }

    // Useful methods to view the underlying data:
    function getNumSamples(uint classIndex) public view returns (uint64) {
        return classInfos[classIndex].numSamples;
    }

    function getCentroidValue(uint classIndex, uint32 featureIndex) public view returns (uint64) {
        return classInfos[classIndex].centroid[featureIndex];
    }

    function getSquaredMagnitude(uint classIndex) public view returns (uint) {
        return classInfos[classIndex].squaredMagnitude;
    }
}
