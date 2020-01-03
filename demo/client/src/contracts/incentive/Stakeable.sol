pragma solidity ^0.5.8;

import "../../../lib/Math.sol";
import "../../../lib/SafeMath.sol";
import "../../../lib/SignedSafeMath.sol";

import {IncentiveMechanism, IncentiveMechanism64} from "./IncentiveMechanism.sol";
import {Ownable} from "../ownership/Ownable.sol";

/**
 * A base class for contracts that want to accept deposits to incentivise good contributions of information.
 */
contract Stakeable is Ownable, IncentiveMechanism {
    using SafeMath for uint256;

    /**
     * A refund has been issued.
     */
    event Refund(
        /**
         * The recipient of the refund which is the one who originally submitted the data contribution.
         */
        address recipient,
        /**
         * The amount refunded.
         */
        uint amount
    );

    /**
     * An award for reporting data has been issued.
     */
    event Report(
        /**
         * The one who submitted the report.
         */
        address recipient,
        /**
         * The amount awarded.
         */
        uint amount
    );

    /**
     * Multiplicative factor for the cost calculation.
     */
    uint public costWeight;

    /**
     * The last time that data was updated in seconds since the epoch.
     */
    uint public lastUpdateTimeS;

    constructor(
        // Parameters in chronological order.
        uint32 _refundWaitTimeS,
        uint32 _ownerClaimWaitTimeS,
        uint32 _anyAddressClaimWaitTimeS,
        uint80 _costWeight
    ) Ownable() IncentiveMechanism(_refundWaitTimeS, _ownerClaimWaitTimeS, _anyAddressClaimWaitTimeS) public {
        require(_refundWaitTimeS <= _ownerClaimWaitTimeS, "Owner claim wait time must be at least the refund wait time.");
        require(_ownerClaimWaitTimeS <= _anyAddressClaimWaitTimeS, "Owner claim wait time must be less than the any address claim wait time.");

        costWeight = _costWeight;

        lastUpdateTimeS = now; // solium-disable-line security/no-block-members
    }

    /**
     * @return The amount of wei required to add data now.
     *
     * Note that since this method uses `now` which depends on the last block time,
     * when testing, the output of this function may not change over time unless blocks are created.
     * @dev see also `getNextAddDataCost(uint)`
     */
    function getNextAddDataCost() public view returns (uint) {
        return getNextAddDataCost(now); // solium-disable-line security/no-block-members
    }

    /**
     * @param currentTimeS The current time in seconds since the epoch.
     *
     * @return The amount of wei required to add data at `currentTimeS`.
     */
    function getNextAddDataCost(uint currentTimeS) public view returns (uint) {
        if (costWeight == 0) {
            return 0;
        }
        // Value sent is in wei (1E18 wei = 1 ether).
        require(lastUpdateTimeS <= currentTimeS, "The last update time is after the current time.");
        // No SafeMath check needed because already done above.
        uint divisor = currentTimeS - lastUpdateTimeS;
        if (divisor == 0) {
            divisor = 1;
        } else {
            divisor = Math.sqrt(divisor);
            // TODO Check that sqrt is "safe".
        }
        return costWeight.mul(1 hours).div(divisor);
    }
}

contract Stakeable64 is IncentiveMechanism64, Stakeable {

    using SafeMath for uint256;
    using SignedSafeMath for int256;

    constructor(
        uint32 _refundWaitTimeS,
        uint32 _ownerClaimWaitTimeS,
        uint32 _anyAddressClaimWaitTimeS,
        uint80 _costWeight
    ) Stakeable(_refundWaitTimeS, _ownerClaimWaitTimeS, _anyAddressClaimWaitTimeS, _costWeight) public {
        // solium-disable-previous-line no-empty-blocks
    }

    function handleAddData(uint msgValue, int64[] memory data, uint64 classification) public onlyOwner returns (uint cost) {
        cost = getNextAddDataCost(data, classification);
        require(msgValue >= cost, "Didn't pay enough for the deposit.");
        lastUpdateTimeS = now; // solium-disable-line security/no-block-members
        totalSubmitted = totalSubmitted.add(1);
    }

    function handleRefund(
        address submitter,
        int64[] memory /* data */, uint64 classification,
        uint addedTime,
        uint claimableAmount, bool claimedBySubmitter,
        uint64 prediction,
        uint /* numClaims */)
        public onlyOwner
        returns (uint refundAmount) {
        refundAmount = claimableAmount;

        // Make sure deposit can be taken.
        require(!claimedBySubmitter, "Deposit already claimed by submitter.");
        require(refundAmount > 0, "There is no reward left to claim.");
        require(now - addedTime >= refundWaitTimeS, "Not enough time has passed."); // solium-disable-line security/no-block-members
        require(prediction == classification, "The model doesn't agree with your contribution.");

        addressStats[submitter].numValid += 1;
        totalGoodDataCount = totalGoodDataCount.add(1);
        emit Refund(submitter, refundAmount);
    }

    function handleReport(
        address reporter,
        int64[] memory /* data */, uint64 classification,
        uint addedTime, address originalAuthor,
        uint initialDeposit, uint claimableAmount, bool claimedByReporter,
        uint64 prediction,
        uint /* numClaims */)
        public onlyOwner
        returns (uint rewardAmount) {
        // Make sure deposit can be taken.

        require(claimableAmount > 0, "There is no reward left to claim.");
        uint timeSinceAddedS = now - addedTime; // solium-disable-line security/no-block-members
        if (timeSinceAddedS >= ownerClaimWaitTimeS && reporter == owner) {
            rewardAmount = claimableAmount;
        } else if (timeSinceAddedS >= anyAddressClaimWaitTimeS) {
            // Enough time has passed, give the entire remaining deposit to the reporter.
            rewardAmount = claimableAmount;
        } else {
            // Don't allow someone to claim back their own deposit if their data was wrong.
            // They can still claim it from another address but they will have had to have sent good data from that address.
            require(reporter != originalAuthor, "Cannot take your own deposit.");

            require(!claimedByReporter, "Deposit already claimed by reporter.");
            require(timeSinceAddedS >= refundWaitTimeS, "Not enough time has passed.");
            require(prediction != classification, "The model should not agree with the contribution.");

            uint numGoodForReporter = addressStats[reporter].numValid;
            require(numGoodForReporter > 0, "The sender has not sent any good data.");
            // Weight the reward by the proportion of good data sent (maybe square the resulting value).
            // One nice reason to do this is to discourage someone from adding bad data through one address
            // and then just using another address to get their full deposit back.
            rewardAmount = initialDeposit.mul(numGoodForReporter).div(totalGoodDataCount);
            if (rewardAmount == 0 || rewardAmount > claimableAmount) {
                // There is too little left to divide up. Just give everything to this reporter.
                rewardAmount = claimableAmount;
            }
        }

        emit Report(reporter, rewardAmount);
    }
}
