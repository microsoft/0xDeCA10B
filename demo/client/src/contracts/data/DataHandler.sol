pragma solidity ^0.6;

import "../../../lib/SafeMath.sol";

import {Ownable} from "../ownership/Ownable.sol";

/**
 * Stores information for added training data and corresponding meta-data.
 */
interface DataHandler {
    function updateClaimableAmount(bytes32 dataKey, uint rewardAmount) external;
}

/**
 * Stores information for added training data and corresponding meta-data.
 */
contract DataHandler64 is Ownable, DataHandler {

    using SafeMath for uint256;

    struct StoredData {
        /**
         * The data stored.
         */
        // Don't store the data because it's not really needed since we emit events when data is added.
        // The main reason for storing the data in here is to ensure equality on future interactions like when refunding.
        // This extra equality check is only necessary if you're worried about hash collisions.
        // int64[] d;
        /**
         * The classification for the data.
         */
        uint64 c;
        /**
         * The time it was added.
         */
        uint t;
        /**
         * The address that added the data.
         */
        address sender;
        /**
         * The amount that was initially given to deposit this data.
         */
        uint initialDeposit;
        /**
         * The amount of the deposit that can still be claimed.
         */
        uint claimableAmount;
        /**
         * The number of claims that have been made for refunds or reports.
         * This should be the size of `claimedBy`.
         */
        uint numClaims;
        /**
         * The set of addresses that claimed a refund or reward on this data.
         */
        mapping(address => bool) claimedBy;
    }

    /**
     * Meta-data for data that has been added.
     */
    mapping(bytes32 => StoredData) public addedData;

    function getClaimableAmount(int64[] memory data, uint64 classification, uint addedTime, address originalAuthor)
            public view returns (uint) {
        bytes32 key = keccak256(abi.encodePacked(data, classification, addedTime, originalAuthor));
        StoredData storage existingData = addedData[key];
        // Validate found value.
        // usually unnecessary: require(isDataEqual(existingData.d, data), "Data is not equal.");
        require(existingData.c == classification, "Classification is not equal.");
        require(existingData.t == addedTime, "Added time is not equal.");
        require(existingData.sender == originalAuthor, "Data isn't from the right author.");

        return existingData.claimableAmount;
    }

    function getInitialDeposit(int64[] memory data, uint64 classification, uint addedTime, address originalAuthor)
            public view returns (uint) {
        bytes32 key = keccak256(abi.encodePacked(data, classification, addedTime, originalAuthor));
        StoredData storage existingData = addedData[key];
        // Validate found value.
        // usually unnecessary: require(isDataEqual(existingData.d, data), "Data is not equal.");
        require(existingData.c == classification, "Classification is not equal.");
        require(existingData.t == addedTime, "Added time is not equal.");
        require(existingData.sender == originalAuthor, "Data isn't from the right author.");

        return existingData.initialDeposit;
    }

    function getNumClaims(int64[] memory data, uint64 classification, uint addedTime, address originalAuthor)
            public view returns (uint) {
        bytes32 key = keccak256(abi.encodePacked(data, classification, addedTime, originalAuthor));
        StoredData storage existingData = addedData[key];
        // Validate found value.
        // usually unnecessary: require(isDataEqual(existingData.d, data), "Data is not equal.");
        require(existingData.c == classification, "Classification is not equal.");
        require(existingData.t == addedTime, "Added time is not equal.");
        require(existingData.sender == originalAuthor, "Data isn't from the right author.");

        return existingData.numClaims;
    }

    /**
     * Check if two arrays of training data are equal.
     */
    function isDataEqual(int64[] memory d1, int64[] memory d2) public pure returns (bool) {
        if (d1.length != d2.length) {
            return false;
        }
        for (uint i = 0; i < d1.length; ++i) {
            if (d1[i] != d2[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Log an attempt to add data.
     *
     * @param msgSender The address of the one attempting to add data.
     * @param cost The cost required to add new data.
     * @param data A single sample of training data for the model.
     * @param classification The label for `data`.
     * @return time The time which the data was added, i.e. the current time in seconds.
     */
    function handleAddData(address msgSender, uint cost, int64[] memory data, uint64 classification)
        public onlyOwner
        returns (uint time) {
        time = now;  // solium-disable-line security/no-block-members
        bytes32 key = keccak256(abi.encodePacked(data, classification, time, msgSender));
        StoredData storage existingData = addedData[key];
        bool okayToOverwrite = existingData.sender == address(0) || existingData.claimableAmount == 0;
        require(okayToOverwrite, "Conflicting data key. The data may have already been added.");
        // Maybe we do want to allow duplicate data to be added but just not from the same address.
        // Of course that is not sybil-proof.

        // Store data.
        addedData[key] = StoredData({
            // not necessary: d: data,
            c: classification,
            t: time,
            sender: msgSender,
            initialDeposit: cost,
            claimableAmount: cost,
            numClaims: 0
        });
    }

    /**
     * Log a refund attempt.
     *
     * @param submitter The address of the one attempting a refund.
     * @param data The data for which to attempt a refund.
     * @param classification The label originally submitted for `data`.
     * @param addedTime The time in seconds for which the data was added.
     * @return claimableAmount The amount that can be claimed for the refund.
     * @return claimedBySubmitter `true` if the data has already been claimed by `submitter`, otherwise `false`.
     * @return numClaims The number of claims that have been made for the contribution before this request.
     */
    function handleRefund(address submitter, int64[] memory data, uint64 classification, uint addedTime)
        public onlyOwner
        returns (uint claimableAmount, bool claimedBySubmitter, uint numClaims) {
        bytes32 key = keccak256(abi.encodePacked(data, classification, addedTime, submitter));
        StoredData storage existingData = addedData[key];
        // Validate found value.
        require(existingData.sender != address(0), "Data not found.");
        // usually unnecessary: require(isDataEqual(existingData.d, data), "Data is not equal.");
        require(existingData.c == classification, "Classification is not equal.");
        require(existingData.t == addedTime, "Added time is not equal.");
        require(existingData.sender == submitter, "Data is not from the sender.");

        claimableAmount = existingData.claimableAmount;
        claimedBySubmitter = existingData.claimedBy[submitter];
        numClaims = existingData.numClaims;

        // Upon successful completion of the refund the values will be claimed.
        existingData.claimableAmount = 0;
        existingData.claimedBy[submitter] = true;
        existingData.numClaims = numClaims.add(1);
    }

    /**
     * Retrieve information about the data to report.
     *
     * @param reporter The address of the one reporting the data.
     * @param data The data to report.
     * @param classification The label submitted for `data`.
     * @param addedTime The time in seconds for which the data was added.
     * @param originalAuthor The address that originally added the data.
     * @return initialDeposit The amount that was initially deposited when the data contribution was submitted.
     * @return claimableAmount The amount remainining that can be claimed.
     * @return claimedByReporter `true` if the data has already been claimed by `reporter`, otherwise `false`.
     * @return numClaims The number of claims that have been made for the contribution before this request.
     * @return dataKey The key to the stored data.
     */
    function handleReport(
        address reporter,
        int64[] memory data, uint64 classification, uint addedTime, address originalAuthor)
        public onlyOwner
        returns (uint initialDeposit, uint claimableAmount, bool claimedByReporter, uint numClaims, bytes32 dataKey) {
        dataKey = keccak256(abi.encodePacked(data, classification, addedTime, originalAuthor));
        StoredData storage existingData = addedData[dataKey];
        // Validate found value.
        require(existingData.sender != address(0), "Data not found.");
        // usually unnecessary: require(isDataEqual(existingData.d, data), "Data is not equal.");
        require(existingData.c == classification, "Classification is not equal.");
        require(existingData.t == addedTime, "Added time is not equal.");
        require(existingData.sender == originalAuthor, "Sender is not equal.");

        initialDeposit = existingData.initialDeposit;
        claimableAmount = existingData.claimableAmount;
        claimedByReporter = existingData.claimedBy[reporter];
        numClaims = existingData.numClaims;

        existingData.claimedBy[reporter] = true;
        existingData.numClaims = numClaims.add(1);
    }

    /**
     * @return `true` if the contribution has already been claimed by `claimer`, otherwise `false`.
     */
    function hasClaimed(
        int64[] memory data, uint64 classification,
        uint addedTime, address originalAuthor,
        address claimer)
        public view returns (bool) {
        bytes32 key = keccak256(abi.encodePacked(data, classification, addedTime, originalAuthor));
        StoredData storage existingData = addedData[key];
        // Validate found value.
        // usually unnecessary: require(isDataEqual(existingData.d, data), "Data is not equal.");
        require(existingData.c == classification, "Classification is not equal.");
        require(existingData.t == addedTime, "Added time is not equal.");
        require(existingData.sender == originalAuthor, "Data isn't from the right author.");

        return existingData.claimedBy[claimer];
    }

    function updateClaimableAmount(bytes32 dataKey, uint rewardAmount)
        public override onlyOwner {
        StoredData storage existingData = addedData[dataKey];
        // Already validated key lookup.
        existingData.claimableAmount = existingData.claimableAmount.sub(rewardAmount);
    }
}
