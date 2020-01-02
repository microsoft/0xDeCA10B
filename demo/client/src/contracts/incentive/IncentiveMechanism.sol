pragma solidity ^0.5.8;

import {Ownable} from "../ownership/Ownable.sol";

/**
 * Defines incentives for others to contribute "good" quality data.
 */
interface IncentiveMechanism {

    /**
     * @return The current cost to update a model with one sample of training data.
     */
    function getNextAddDataCost() external view returns (uint);
}

/**
 * An `IncentiveMechanism` for data with 64-bit values.
 */
contract IncentiveMechanism64 is Ownable, IncentiveMechanism {
    /**
     * @return The current cost to update a model with one sample of training data.
     */
    function getNextAddDataCost() public view returns (uint);

    // Documenting parameters differently to avoid compilation errors.
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
     * @return The amount to refund to `submitter`.
     */
    function handleRefund(
        address submitter,
        int64[] memory data, uint64 classification,
        uint addedTime,
        uint claimableAmount, bool claimedBySubmitter,
        uint64 prediction)
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
     * @return The amount to reward to `reporter`.
     */
    function handleReport(
        address reporter,
        int64[] memory data, uint64 classification,
        uint addedTime, address originalAuthor,
        uint initialDeposit, uint claimableAmount, bool claimedByReporter,
        uint64 prediction)
        public
        returns (uint rewardAmount);
}
