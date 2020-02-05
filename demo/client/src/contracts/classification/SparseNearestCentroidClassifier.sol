pragma solidity ^0.5.8;
pragma experimental ABIEncoderV2;

import "../../../lib/Math.sol";

import {Classifier64} from "./Classifier.sol";

/**
 * A nearest centroid classifier that uses Euclidean distance to predict the closest centroid based on sparse data sample.
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

    uint64[][] public centroids;
    uint[] public dataCounts;

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
        for (uint i = 1; i < centroids.length; ++i) {
            require(centroids[i].length == dimensions, "Inconsistent number of dimensions.");
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
        for (uint i = 0; i < extension.length; ++i) {
            centroids[classification].push(extension[i]);
        }
    }

    function addClass(uint64[] memory centroid, string memory classification, uint dataCount) public onlyOwner {
        require(classifications.length + 1 < 2 ** 64, "There are too many classes already.");
        require(centroid.length == centroids[0].length, "Data doesn't have the correct number of dimensions.");
        require(dataCount < dataCountLimit, "Data count is too large.");
        classifications.push(classification);
        centroids.push(centroid);
        dataCounts.push(dataCount);
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
            uint distance = 0;
            uint dataIndex = 0;
            for (uint64 j = 0; j < centroids[currentClass].length; ++j) {
                if (dataIndex < data.length && data[dataIndex] == int64(j)) {
                    // Feature is present.
                    // Safe calculation because both values are int64.
                    int256 diff = toFloat;
                    diff -= centroids[currentClass][j];
                    diff *= diff;
                    // Convert back to our float representation.
                    diff /= toFloat;
                    distance = distance.add(uint256(diff));
                    ++dataIndex;

                    if (distance >= minDistance) {
                        break;
                    }
                } else {
                    // Feature is not present.
                    uint256 diff = centroids[currentClass][j];
                    diff *= diff;
                    // Convert back to our float representation.
                    diff /= toFloat;
                    distance = distance.add(diff);
                }
            }
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
        uint dataIndex = 0;
        for (uint64 featureIndex = 0; featureIndex < centroids[classification].length; ++featureIndex) {
            if (dataIndex < data.length && data[dataIndex] == int64(featureIndex)) {
                // Feature is present.
                centroids[classification][featureIndex] = uint64((int(centroid[featureIndex]) * int(n) + toFloat) / int(newN));
                ++dataIndex;
            } else {
                // Feature is not present.
                centroids[classification][featureIndex] = uint64((int(centroid[featureIndex]) * int(n)) / int(newN));
            }
        }
    }
}
