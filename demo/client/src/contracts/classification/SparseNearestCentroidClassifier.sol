pragma solidity ^0.5.8;
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

    int256 constant public INT256_MAX = int256(~(uint256(1) << 255));
    uint256 constant public UINT256_MAX = ~uint256(0);

    uint256 constant public dataCountLimit = 2 ** (256 - 64 - 1);

    uint64[][] public centroids;

    /**
     * The number of samples for each class.
     */
    uint[] public dataCounts;

    /**
     * The squared 2-norm of each centroid. Multiplied by (toFloat * toFloat).
     */
    uint[] public squaredMagnitudes;

    constructor(
        string[] memory _classifications,
        uint64[][] memory _centroids,
        uint[] memory _dataCounts)
        Classifier64(_classifications) public {
        require(_centroids.length == _classifications.length, "The number of centroids and classifications must be the same.");
        require(_classifications.length > 0, "At least one class is required.");
        require(_classifications.length < 2 ** 64, "Too many classes given.");
        centroids = _centroids;
        dataCounts = _dataCounts;
        uint dimensions = centroids[0].length;
        require(dimensions < 2 ** 63, "First centroid is too long.");
        for (uint i = 0; i < centroids.length; ++i) {
            require(_centroids[i].length == dimensions, "Inconsistent number of dimensions.");
            squaredMagnitudes.push(getMagnitude(_centroids[i]));
        }
    }

    function getMagnitude(uint64[] memory vector) internal pure returns (uint squaredMagnitude) {
        squaredMagnitude = 0;
        for (uint i = 0; i < vector.length; ++i) {
            squaredMagnitude = squaredMagnitude.add(uint(vector[i]) * vector[i]);
        }
    }

    /**
     * Extend the number of dimensions of a centroid.
     * Made to be called just after the contract is created and never again.
     * @param extension The values to append to a centroid vector.
     * @param classification The class to add the extension to.
     */
    function extendCentroid(uint64[] memory extension, uint64 classification) public onlyOwner {
        require(classification < centroids.length, "This classification has not been added yet.");
        require(centroids[classification].length + extension.length < 2 ** 63, "Centroid would be too long.");
        uint squaredMagnitude = squaredMagnitudes[classification];
        for (uint i = 0; i < extension.length; ++i) {
            centroids[classification].push(extension[i]);
            squaredMagnitude = squaredMagnitude.add(uint(extension[i]) * extension[i]);
        }
        squaredMagnitudes[classification] = squaredMagnitude;
    }

    function addClass(uint64[] memory centroid, string memory classification, uint dataCount) public onlyOwner {
        require(classifications.length + 1 < 2 ** 64, "There are too many classes already.");
        require(centroid.length == centroids[0].length, "Data doesn't have the correct number of dimensions.");
        require(dataCount < dataCountLimit, "Data count is too large.");
        classifications.push(classification);
        centroids.push(centroid);
        dataCounts.push(dataCount);
        squaredMagnitudes.push(getMagnitude(centroid));
        emit AddClass(classification, classifications.length - 1);
    }

    function norm(int64[] memory /* data */) public pure returns (uint) {
        revert("Normalization is not required.");
    }

    function predict(int64[] memory data) public view returns (uint64 bestClass) {
        // Sparse representation: each number in data is a feature index.
        // Assume values in data are sorted in increasing order.

        uint minDistance = UINT256_MAX;
        bestClass = 0;
        for (uint64 currentClass = 0; currentClass < centroids.length; ++currentClass) {
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
                distanceUpdate += int(toFloat) - 2 * centroids[currentClass][uint(data[dataIndex])];
            }

            uint distance = uint(int(squaredMagnitudes[currentClass]) + distanceUpdate * toFloat);

            if (distance < minDistance) {
                minDistance = distance;
                bestClass = currentClass;
            }
        }
    }

    function update(int64[] memory data, uint64 classification) public onlyOwner {
        require(classification < centroids.length, "This classification has not been added yet.");
        uint64[] memory centroid = centroids[classification];
        uint n = dataCounts[classification];
        uint newN;
        // Keep n small enough for multiplication.
        if (n >= dataCountLimit) {
            newN = dataCounts[classification];
        } else {
            newN = dataCounts[classification] + 1;
            dataCounts[classification] = newN;
        }

        // Update centroid using moving average calculation.
        uint squaredMagnitude = 0;
        uint dataIndex = 0;
        for (uint64 featureIndex = 0; featureIndex < centroids[classification].length; ++featureIndex) {
            if (dataIndex < data.length && data[dataIndex] == int64(featureIndex)) {
                // Feature is present.
                uint64 v = uint64((int(centroid[featureIndex]) * int(n) + toFloat) / int(newN));
                centroids[classification][featureIndex] = v;
                ++dataIndex;
                squaredMagnitude = squaredMagnitude.add(uint(v) * v);
            } else {
                // Feature is not present.
                uint64 v = uint64((int(centroid[featureIndex]) * int(n)) / int(newN));
                centroids[classification][featureIndex] = v;
                squaredMagnitude = squaredMagnitude.add(uint(v) * v);
            }
        }
        squaredMagnitudes[classification] = squaredMagnitude;
    }
}
