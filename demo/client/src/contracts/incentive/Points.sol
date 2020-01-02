pragma solidity ^0.5.8;

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

    event Refund(
        address recipient
    );

    event Report(
        address recipient
    );

    struct AddressStats {
        uint128 numSubmitted;
        uint128 numValidated;
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

    function handleAddData(uint /* msgValue */, int64[] memory /* data */, uint64 /* classification */) public onlyOwner returns (uint cost) {
        cost = 0;
        totalSubmitted = totalSubmitted.add(1);
    }

    function handleRefund(
        address submitter,
        int64[] memory /* data */, uint64 classification,
        uint /* addedTime */,
        uint claimableAmount, bool claimedBySubmitter,
        uint64 prediction,
        uint numClaims)
        public onlyOwner
        returns (uint refundAmount) {
        // `claimableAmount` should be 0.
        refundAmount = claimableAmount;

        require(numClaims == 0, "Already claimed.");
        require(!claimedBySubmitter, "Already claimed by submitter.");
        require(prediction == classification, "The model doesn't agree with your contribution.");

        addressStats[submitter].numValidated += 1;
        totalGoodDataCount = totalGoodDataCount.add(1);
        emit Refund(submitter);
    }

    function handleReport(
        address reporter,
        int64[] memory /* data */, uint64 classification,
        uint /* addedTime */, address originalAuthor,
        uint /* initialDeposit */, uint claimableAmount, bool claimedByReporter,
        uint64 prediction,
        uint numClaims)
        public onlyOwner
        returns (uint rewardAmount) {
        // `claimableAmount` should be 0.
        rewardAmount = claimableAmount;

        require(numClaims == 0, "Already claimed.");
        require(reporter != originalAuthor, "Cannot report yourself.");

        require(!claimedByReporter, "Already claimed by reporter.");
        require(prediction != classification, "The model should not agree with the contribution.");

        emit Report(reporter);
    }
}
