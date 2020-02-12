pragma solidity ^0.6;

import "../../../lib/Math.sol";
import "../../../lib/SafeMath.sol";
import "../../../lib/SignedSafeMath.sol";

import {IncentiveMechanism, IncentiveMechanism64} from "./IncentiveMechanism.sol";
import {Ownable} from "../ownership/Ownable.sol";

/**
 * A base class for contracts that want to reward contributions with points and no financial rewards.
 */
contract Points is Ownable, IncentiveMechanism {
    using SafeMath for uint256;

    /**
     * A data contribution has been validated.
     */
    event Refund(
        /**
         * The recipient of the refund which is the one who originally submitted the data contribution.
         */
        address recipient
    );

    /**
     * An award for reporting data has been issued.
     */
    event Report(
        /**
         * The one who submitted the report.
         */
        address recipient
    );

    constructor(
        uint32 _refundWaitTimeS,
        uint32 _ownerClaimWaitTimeS,
        uint32 _anyAddressClaimWaitTimeS
    ) Ownable() IncentiveMechanism(_refundWaitTimeS, _ownerClaimWaitTimeS, _anyAddressClaimWaitTimeS) public {
    }

    function getNextAddDataCost() public override view returns (uint) {
        return 0;
    }

    function getNextAddDataCost(uint /* currentTimeS */) public override view returns (uint) {
        return 0;
    }
}

contract Points64 is IncentiveMechanism64, Points {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    constructor(
        uint32 _refundWaitTimeS,
        uint32 _ownerClaimWaitTimeS,
        uint32 _anyAddressClaimWaitTimeS
    ) Points(_refundWaitTimeS, _ownerClaimWaitTimeS, _anyAddressClaimWaitTimeS) public {
    }

    function getNextAddDataCost(int64[] memory /* data */, uint64 /* classification */)
        public override view
        returns (uint) {
        return 0;
    }

    function handleAddData(uint /* msgValue */, int64[] memory /* data */, uint64 /* classification */)
        public override onlyOwner returns (uint cost) {
        cost = 0;
        totalSubmitted = totalSubmitted.add(1);
    }

    function handleRefund(
        address submitter,
        int64[] memory /* data */, uint64 classification,
        uint addedTime,
        uint claimableAmount, bool claimedBySubmitter,
        uint64 prediction,
        uint numClaims)
        public override onlyOwner
        returns (uint refundAmount) {
        // `claimableAmount` should be 0.
        refundAmount = claimableAmount;

        require(numClaims == 0, "Already claimed.");
        require(!claimedBySubmitter, "Already claimed by submitter.");
        require(now - addedTime >= refundWaitTimeS, "Not enough time has passed."); // solium-disable-line security/no-block-members
        require(prediction == classification, "The model doesn't agree with your contribution.");

        addressStats[submitter].numValid += 1;
        totalGoodDataCount = totalGoodDataCount.add(1);
        emit Refund(submitter);
    }

    function handleReport(
        address reporter,
        int64[] memory /* data */, uint64 classification,
        uint addedTime, address originalAuthor,
        uint /* initialDeposit */, uint claimableAmount, bool claimedByReporter,
        uint64 prediction,
        uint numClaims)
        public override onlyOwner
        returns (uint rewardAmount) {
        // `claimableAmount` should be 0.
        rewardAmount = claimableAmount;

        uint timeSinceAddedS = now - addedTime; // solium-disable-line security/no-block-members
        require(
            timeSinceAddedS >= refundWaitTimeS ||
            timeSinceAddedS >= anyAddressClaimWaitTimeS ||
            (timeSinceAddedS >= ownerClaimWaitTimeS && reporter == owner),
            "Cannot be claimed yet.");

        require(numClaims == 0, "Already claimed.");
        require(reporter != originalAuthor, "Cannot report yourself.");

        require(!claimedByReporter, "Already claimed by reporter.");
        require(prediction != classification, "The model should not agree with the contribution.");

        emit Report(reporter);
    }
}
