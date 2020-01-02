const Stakeable64 = artifacts.require("./incentive/Stakeable64");

const utils = require('../../../src/utils.js');

contract('Stakeable64', function (accounts) {
  const refundTimeS = 1;
  const ownerClaimWaitTimeS = 2;
  const anyAddressClaimWaitTimeS = 3;
  const costWeight = 1E12;
  let stakeable;

  function parseBN(num) {
    if (web3.utils.isBN(num)) {
      return num.toNumber();
    } else {
      assert.typeOf(num, 'number');
      return num;
    }
  }

  before("deploy Stakeable", async () => {
    stakeable = await Stakeable64.new(refundTimeS,
      ownerClaimWaitTimeS, anyAddressClaimWaitTimeS, costWeight);

    // Validate some data for each account.
    const ownerAddress = accounts[0];
    const otherAddress = accounts[1];
    const data = [];
    const prediction = classification = 0;
    const addedTime = Math.floor(new Date().getTime() / 1000);
    const claimedBySubmitter = false;

    let claimableAmount;
    let cost;
    let refundAmount;

    // Make sure two accounts have "verified" contributions.

    // Add data as owner.
    cost = await stakeable.getNextAddDataCost().then(parseBN);
    // Just get the cost (with .call()).
    cost = await stakeable.handleAddData.call(cost, data, classification).then(parseBN);
    // Actually make the transaction.
    await stakeable.handleAddData(cost, data, classification);
    await utils.setTimeoutPromise(refundTimeS * 1000);
    claimableAmount = cost;
    let refundResponse = await stakeable.handleRefund(ownerAddress, data, classification,
      addedTime, claimableAmount, claimedBySubmitter,
      prediction, { from: ownerAddress });
    let e = refundResponse.logs.filter(e => e.event == 'Refund')[0];
    refundAmount = parseBN(e.args.amount);
    assert.equal(refundAmount, claimableAmount);

    // Add data as someone else.
    cost = await stakeable.getNextAddDataCost().then(parseBN);
    // Really this one should be called as if it's from the other address but that isn't required by the contract yet.
    // Get the cost (with .call()).
    cost = await stakeable.handleAddData.call(cost, data, classification).then(parseBN);
    // Actually make the transaction.
    await stakeable.handleAddData(cost, data, classification);
    await utils.setTimeoutPromise(refundTimeS * 1000);
    claimableAmount = cost;
    refundAmount = await stakeable.handleRefund.call(otherAddress, data, classification,
      addedTime, claimableAmount, claimedBySubmitter,
      prediction, { from: ownerAddress });
    assert.equal(refundAmount, claimableAmount);
    await stakeable.handleRefund(otherAddress, data, classification,
      addedTime, claimableAmount, claimedBySubmitter,
      prediction, { from: ownerAddress });
  });

  it("...should get full deposit", async () => {
    const ownerAddress = accounts[0];
    const otherAddress = accounts[1];
    const data = [];
    const prediction = classification = 0;

    const totalGoodDataCount = await stakeable.totalGoodDataCount.call().then(parseBN);
    const numGoodForOther = await stakeable.numGoodDataPerAddress.call(otherAddress).then(parseBN);

    const addedTime = Math.floor(new Date().getTime() / 1000);

    let cost;
    let rewardAmount;

    // If this test fails because of time differences too much,
    // then we could consider changing setting addedTime for each transaction call depending on what should happen.

    // Submit new data.
    cost = await stakeable.getNextAddDataCost().then(parseBN);
    // Just get the cost (with .call()).
    cost = await stakeable.handleAddData.call(cost, data, classification).then(parseBN);
    // Actually make the transaction.
    await stakeable.handleAddData(cost, data, classification);

    // Wait until the refund period.
    await utils.setTimeoutPromise(refundTimeS * 1000 - (new Date().getTime() - addedTime * 1000));

    await stakeable.handleReport(ownerAddress,
      data, classification,
      addedTime, ownerAddress,
      cost, cost, false,
      prediction).then(_ => {
        assert.fail("Reporting should have failed because \"Cannot take your own deposit.\".");
      }).catch(err => {
        assert.equal(err.message, "Returned error: VM Exception while processing transaction: revert Cannot take your own deposit. -- Reason given: Cannot take your own deposit..");
      });

    rewardAmount = await stakeable.handleReport.call(otherAddress,
      data, classification,
      addedTime, ownerAddress,
      cost, cost, false,
      // Prediction was the wrong classification.
      classification + 1).then(parseBN);
    assert.equal(rewardAmount, Math.floor(cost * numGoodForOther / totalGoodDataCount), "The reward amount should be split amongst those with \"verified\" data contributions.");

    // Again check that we are still in the refund period and not the any take period.
    assert.isAtMost(new Date().getTime() / 1000, addedTime + ownerClaimWaitTimeS, "We are in the owner claim period. It took too long to process transactions. You can try increasing `ownerClaimWaitTimeS`.");

    // Try to take everything as the owner.
    // Sleep until the owner can report and take everything.
    await utils.setTimeoutPromise(ownerClaimWaitTimeS * 1000 - (new Date().getTime() - addedTime * 1000));

    // Check that the owner can take the entire deposit.
    let reportResponse = await stakeable.handleReport(ownerAddress,
      data, classification,
      addedTime, ownerAddress,
      cost, cost, false,
      prediction);
    let e = reportResponse.logs.filter(e => e.event == 'Report')[0];
    rewardAmount = parseBN(e.args.amount);
    assert.equal(rewardAmount, cost, "The reward amount should be the entire initial deposit.");

    // Sleep until any address can report.
    await utils.setTimeoutPromise(anyAddressClaimWaitTimeS * 1000 - (new Date().getTime() - addedTime * 1000));

    // Check that we can take the entire deposit as another address.
    // Note that there are still funds left to claim because the IM does not update the meta-data.
    // Actually report.
    reportResponse = await stakeable.handleReport(otherAddress,
      data, classification,
      addedTime, ownerAddress,
      cost, cost, false,
      prediction);
    e = reportResponse.logs.filter(e => e.event == 'Report')[0];
    rewardAmount = parseBN(e.args.amount);
    assert.equal(rewardAmount, cost, "The reward amount should be the entire initial deposit.");

  });
});
