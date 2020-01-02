pragma solidity ^0.5.8;
pragma experimental ABIEncoderV2;

import "../../../lib/Math.sol";

import {Classifier64} from "./Classifier.sol";

/**
 * https://en.wikipedia.org/wiki/Nearest_centroid_classifier
 */
contract NearestCentroidClassifier is Classifier64 {
    /** A class has been added. */
    event AddClass(
        /** The name of the class. */
        string name,
        /** The index for the class in the members of this classifier. */
        uint index
    );

    uint256 constant public UINT256_MAX = ~uint256(0);

    uint256 constant public dataCountLimit = 2 ** (256 - 64 - 1);

    int64[][] public centroids;
    uint[] public dataCounts;

    constructor(
        string[] memory _classifications,
        int64[][] memory _centroids,
        uint[] memory _dataCounts)
        Classifier64(_classifications) public {
        require(_centroids.length == _classifications.length, "The number of centroids and classifications must be the same.");
        require(_classifications.length > 0, "At least one class is required.");
        require(_classifications.length < 2 ** 64, "Too many classes given.");
        centroids = _centroids;
        dataCounts = _dataCounts;
        uint dimensions = centroids[0].length;
        for (uint i = 1; i < centroids.length; ++i) {
            require(centroids[i].length == dimensions, "Inconsistent number of dimensions.");
        }
    }

    function addClass(int64[] memory centroid, string memory classification, uint dataCount) public onlyOwner {
        require(classifications.length + 1 < 2 ** 64, "There are too many classes already.");
        require(centroid.length == centroids[0].length, "Data doesn't have the correct number of dimensions.");
        require(dataCount < dataCountLimit, "Data count is too large.");
        classifications.push(classification);
        centroids.push(centroid);
        dataCounts.push(dataCount);
        emit AddClass(classification, classifications.length - 1);
    }

    function norm(int64[] memory data) public pure returns (uint result) {
        result = 0;
        for (uint i = 0; i < data.length; ++i) {
            result = result.add(uint(int128(data[i]) * data[i]));
        }
        result = Math.sqrt(result);
    }

    function predict(int64[] memory data) public view returns (uint64 bestClass) {
        require(data.length == centroids[0].length, "Data doesn't have the correct length.");
        uint minDistance = UINT256_MAX;
        bestClass = 0;
        for (uint64 currentClass = 0; currentClass < centroids.length; ++currentClass) {
            uint distance = 0;
            for (uint j = 0; j < data.length; ++j) {
                // Safe calculation because both values are int64.
                int diff = data[j];
                diff -= centroids[currentClass][j];
                diff *= diff;
                // Convert back to our float representation.
                diff /= toFloat;
                distance = distance.add(uint(diff));
                if (distance >= minDistance) {
                    break;
                }
            }
            if (distance < minDistance) {
                minDistance = distance;
                bestClass = currentClass;
            }
        }
    }

    function update(int64[] memory data, uint64 classification) public onlyOwner {
        require(data.length == centroids[classification].length, "Data doesn't have the correct number of dimensions.");
        require(classification < classifications.length, "Classification is out of bounds.");
        int64[] memory centroid = centroids[classification];
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
        int64[] memory c = new int64[](data.length);
        uint _norm = 0;
        for (uint j = 0; j < data.length; ++j) {
            int128 datum = int128(data[j]);
            _norm = _norm.add(uint(datum * datum));
            c[j] = int64((int(centroid[j]) * int(n) + datum) / int(newN));
        }
        centroids[classification] = c;

        // Must be almost within `toFloat` of `toFloat*toFloat` because we only care about the first `toFloat` digits.
        uint oneSquared = uint(toFloat).mul(toFloat);
        uint offset = uint(toFloat) * 100;
        require(oneSquared - offset < _norm && _norm < oneSquared + offset, "The provided data does not have a norm of 1.");
    }
}
