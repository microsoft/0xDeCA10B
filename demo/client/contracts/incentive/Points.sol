pragma solidity ^0.5.8;

import "../libs/Math.sol";
import "../libs/SafeMath.sol";
import "../libs/SignedSafeMath.sol";

import {IncentiveMechanism, IncentiveMechanism64} from "./IncentiveMechanism.sol";
import {Ownable} from "../ownership/Ownable.sol";

/**
 * A base class for contracts that want to accept deposits to incentivise good contributions of information.
 */
contract Points is Ownable, IncentiveMechanism {
    using SafeMath for uint256;

    event Refund(
        address recipient,
        uint amount
    );

    event Report(
        address recipient,
        uint amount
    );

    struct AddressStats {
        uint numSubmitted;
    }

    mapping(address => AddressStats) public addressStats;

    /**
     * The total number of samples that have been submitted.
     */
    uint128 public totalSubmitted = 0;

    constructor(
    ) Ownable() public {
    }

    function getNextAddDataCost() public view returns (uint) {
        return 0;
    }
}

contract Points64 is IncentiveMechanism64, Points {

    using SafeMath for uint256;
    using SignedSafeMath for int256;

    constructor(
    ) Points() public {
    }

    function handleAddData(uint msgValue, int64[] memory data, uint64 classification) public onlyOwner returns (uint cost) {
        cost = 0;
    }

    function handleRefund(
        address submitter,
        int64[] memory /* data */, uint64 classification,
        uint addedTime,
        uint claimableAmount, bool claimedBySubmitter,
        uint64 prediction)
        public onlyOwner
        returns (uint refundAmount) {
            // TODO FIXME
        refundAmount = claimableAmount;

        // Make sure deposit can be taken.
        require(!claimedBySubmitter, "Deposit already claimed by submitter.");
        require(refundAmount > 0, "There is no reward left to claim.");
        require(now - addedTime >= refundWaitTimeS, "Not enough time has passed."); // solium-disable-line security/no-block-members
        require(prediction == classification, "The model doesn't agree with your contribution.");

        numGoodDataPerAddress[submitter] += 1;
        totalGoodDataCount += 1;
        emit Refund(submitter, refundAmount);
    }

    function handleReport(
        address reporter,
        int64[] memory /* data */, uint64 classification,
        uint addedTime, address originalAuthor,
        uint initialDeposit, uint claimableAmount, bool claimedByReporter,
        uint64 prediction)
        public onlyOwner
        returns (uint rewardAmount) {
            // TODO FIXME
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
            require(reporter != originalAuthor, "Cannot take your own deposit. Ask for a refund instead.");

            require(!claimedByReporter, "Deposit already claimed by reporter.");
            require(timeSinceAddedS >= refundWaitTimeS, "Not enough time has passed.");
            require(prediction != classification, "The model should not agree with the contribution.");

            uint numGoodForReporter = numGoodDataPerAddress[reporter];
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
