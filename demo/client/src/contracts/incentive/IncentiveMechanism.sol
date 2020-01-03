pragma solidity ^0.5.8;

import {Ownable} from "../ownership/Ownable.sol";

/**
 * Defines incentives for others to contribute "good" quality data.
 */
contract IncentiveMechanism {
    struct AddressStats {
        uint128 numValid;
        uint128 numSubmitted;
    }

    mapping(address => AddressStats) public addressStats;

    /**
     * The total number of samples that have been submitted.
     */
    uint public totalSubmitted = 0;

    /**
     * The total number of samples that have been determined to be good.
     */
    uint public totalGoodDataCount = 0;

    // The following members are in chronologically increasing order of when they should occur.
    /**
     * Amount of time to wait to get a refund back.
     * Once this amount of time has passed, the entire deposit can be reclaimed.
     * Also once this amount of time has passed, the deposit (in full or in part) can be taken by others.
     */
    uint32 public refundWaitTimeS;

    /**
     * Amount of time owner has to wait to take someone's entire remaining refund.
     * The purpose of this is to give the owner some incentive to deploy a model.
     * This must be greater than the required amount of time to wait for attempting a refund.
     * Contracts may want to enforce that this is much greater than the amount of time to wait for attempting a refund
     * to give even more time to get the deposit back and not let the owner take too much.
     */
    uint32 public ownerClaimWaitTimeS;

    /**
     * Amount of time after which anyone can take someone's entire remaining refund.
     * Similar to `ownerClaimWaitTimeS` but it allows any address to claim funds for specific data.
     * The purpose of this is to help ensure that value does not get "stuck" in a contract.
     * This must be greater than the required amount of time to wait for attempting a refund.
     * Contracts may want to enforce that this is much greater than the amount of time to wait for attempting a refund
     * to give even more time to get the deposit back and not let others take too much.
     */
    uint32 public anyAddressClaimWaitTimeS;
    // End claim time members.

    constructor(
        // Parameters in chronological order.
        uint32 _refundWaitTimeS,
        uint32 _ownerClaimWaitTimeS,
        uint32 _anyAddressClaimWaitTimeS
    ) public {
        refundWaitTimeS = _refundWaitTimeS;
        ownerClaimWaitTimeS = _ownerClaimWaitTimeS;
        anyAddressClaimWaitTimeS = _anyAddressClaimWaitTimeS;
    }

    /**
     * @return The current cost (in wei) to update a model with one sample of training data.
     */
    function getNextAddDataCost() public view returns (uint);

    /**
     * @param currentTimeS The current time in seconds since the epoch.
     *
     * @return The amount of wei required to add data at `currentTimeS`.
     */
    function getNextAddDataCost(uint currentTimeS) public view returns (uint);

    /**
     * @return The number of samples that have been determined to be good for `submitter`.
     */
    function numValidForAddress(address submitter) public view returns (uint128) {
        return addressStats[submitter].numValid;
    }
}

/**
 * An `IncentiveMechanism` for data with 64-bit values.
 */
contract IncentiveMechanism64 is Ownable, IncentiveMechanism {

    // Documenting parameters without "@" to avoid compilation errors since the parameters are not used.
    /**
     * param data A single sample of training data for the model.
     * param classification The label for `data`.
     * @return The current cost to update a model with a specific sample of training data.
     */
    function getNextAddDataCost(int64[] memory /* data */, uint64 /* classification */)
        public view
        returns (uint) {
        // Default implementation.
        return getNextAddDataCost();
    }

    /**
     * Determine if the request to add data is acceptable.
     *
     * @param msgValue The value sent with the initial transaction to add data.
     * @param data A single sample of training data for the model.
     * @param classification The label for `data`.
     * @return The cost required to add new data.
     */
    function handleAddData(uint msgValue, int64[] memory data, uint64 classification)
        public
        returns (uint cost);

    /**
     * Notify that a refund is being attempted.
     *
     * @param submitter The address of the one attempting a refund.
     * @param data The data for which to attempt a refund.
     * @param classification The label originally submitted with `data`.
     * @param addedTime The time when the data was added.
     * @param claimableAmount The amount that can be claimed for the refund.
     * @param claimedBySubmitter True if the data has already been claimed by `submitter`, otherwise false.
     * @param prediction The current prediction of the model for data.
     * @param numClaims The number of claims that have been made for the contribution before this request.
     * @return The amount to refund to `submitter`.
     */
    function handleRefund(
        address submitter,
        int64[] memory data, uint64 classification,
        uint addedTime,
        uint claimableAmount, bool claimedBySubmitter,
        uint64 prediction,
        uint numClaims)
        public
        returns (uint refundAmount);

    /**
     * Notify that data is being reported as bad or old.
     *
     * @param reporter The address of the one reporting about the data.
     * @param data The data being reported.
     * @param classification The label originally submitted with `data`.
     * @param addedTime The time when the data was added.
     * @param originalAuthor The address that originally added the data.
     * @param initialDeposit The amount initially deposited when the data was added.
     * @param claimableAmount The amount of the deposit that can still be claimed.
     * @param claimedByReporter True if the data has already been claimed by `reporter`, otherwise false.
     * @param prediction The current prediction of the model for data.
     * @param numClaims The number of claims that have been made for the contribution before this request.
     * @return The amount to reward to `reporter`.
     */
    function handleReport(
        address reporter,
        int64[] memory data, uint64 classification,
        uint addedTime, address originalAuthor,
        uint initialDeposit, uint claimableAmount, bool claimedByReporter,
        uint64 prediction,
        uint numClaims)
        public
        returns (uint rewardAmount);
}
