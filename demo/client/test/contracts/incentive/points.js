const Points64 = artifacts.require("./incentive/Points64")

contract('Points64', function (accounts) {
	let im

	function parseBN(num) {
		if (web3.utils.isBN(num)) {
			return num.toNumber()
		} else {
			assert.typeOf(num, 'number')
			return num
		}
	}

	before("deploy Points", async () => {
		im = await Points64.new(0, 0, 0)
	})

	it("...should be free", async () => {
		assert.equal(await im.getNextAddDataCost().then(parseBN), 0)
	})

	it("...should refund and report", async () => {
		let totalGoodDataCount = await im.totalGoodDataCount.call().then(parseBN)

		const data = []
		const prediction = classification = 0
		const claimableAmount = cost = await im.handleAddData.call(0, data, classification).then(parseBN)
		assert.equal(cost, 0)
		// Actually make the transaction.
		await im.handleAddData(cost, data, classification)

		const ownerAddress = accounts[0]
		const otherAddress = accounts[1]
		const addedTime = Math.floor(new Date().getTime() / 1000)
		const claimedBySubmitter = false

		const refundAmount = await im.handleRefund.call(otherAddress, data, classification,
			addedTime, claimableAmount, claimedBySubmitter,
			prediction, 0, { from: ownerAddress })
		assert.equal(refundAmount, 0)

		const numValidBefore = await im.numValidForAddress.call(ownerAddress).then(parseBN)
		assert.equal(numValidBefore, 0)
		let refundResponse = await im.handleRefund(ownerAddress, data, classification,
			addedTime, claimableAmount, claimedBySubmitter,
			prediction, 0, { from: ownerAddress })
		let e = refundResponse.logs.filter(e => e.event == 'Refund')[0]
		assert.equal(e.args.recipient, ownerAddress)
		totalGoodDataCount += 1
		assert.equal(await im.totalGoodDataCount.call().then(parseBN), totalGoodDataCount)
		assert.equal(await im.numValidForAddress.call(ownerAddress).then(parseBN), numValidBefore + 1)

		const rewardAmount = await im.handleReport.call(otherAddress,
			data, classification,
			addedTime, ownerAddress,
			cost, cost, false,
			// Prediction was the wrong classification.
			classification + 1, 0).then(parseBN)
		assert.equal(rewardAmount, 0)

		let reportResponse = await im.handleReport(otherAddress,
			data, classification,
			addedTime, ownerAddress,
			cost, cost, false,
			// Prediction was the wrong classification.
			classification + 1, 0)
		e = reportResponse.logs.filter(e => e.event == 'Report')[0]
		assert.equal(e.args.recipient, otherAddress)
	})

	it("...should not refund twice", async () => {
		let totalGoodDataCount = await im.totalGoodDataCount.call().then(parseBN)

		const claimableAmount = cost = 0
		const data = [0]
		const prediction = classification = 0
		await im.handleAddData(cost, data, classification)

		const ownerAddress = accounts[0]
		const otherAddress = accounts[1]
		const addedTime = Math.floor(new Date().getTime() / 1000)
		const claimedBySubmitter = false

		const numValidBefore = await im.numValidForAddress.call(ownerAddress).then(parseBN)
		assert.equal(numValidBefore, 1)
		const refundResponse = await im.handleRefund(ownerAddress, data, classification,
			addedTime, claimableAmount, claimedBySubmitter,
			prediction, 0, { from: ownerAddress })
		let e = refundResponse.logs.filter(e => e.event == 'Refund')[0]
		assert.equal(e.args.recipient, ownerAddress)
		totalGoodDataCount += 1
		assert.equal(await im.totalGoodDataCount.call().then(parseBN), totalGoodDataCount)
		assert.equal(await im.numValidForAddress.call(ownerAddress).then(parseBN), numValidBefore + 1)

		await im.handleRefund(otherAddress, data, classification,
			addedTime, claimableAmount, claimedBySubmitter,
			prediction, 1).then(_ => {
			assert.fail("The second refund should have failed.")
		}).catch(err => {
			const msg = "Already claimed."
			assert.equal(err.message, `Returned error: VM Exception while processing transaction: revert ${msg} -- Reason given: ${msg}.`)
		})
	})

	it("...should not report twice", async () => {
		const cost = 0
		const data = [1]
		const classification = 0
		// Prediction was the wrong classification.
		const prediction = 1
		await im.handleAddData(cost, data, classification)

		const ownerAddress = accounts[0]
		const otherAddress = accounts[1]
		const anotherAddress = accounts[2]
		const addedTime = Math.floor(new Date().getTime() / 1000)

		await im.handleReport(otherAddress,
			data, classification,
			addedTime, ownerAddress,
			cost, cost, false,
			prediction, 0)

		await im.handleReport(anotherAddress,
			data, classification,
			addedTime, ownerAddress,
			cost, cost, false,
			prediction, 1).then(_ => {
			assert.fail("The second report should have failed.")
		}).catch(err => {
			const msg = "Already claimed."
			assert.equal(err.message, `Returned error: VM Exception while processing transaction: revert ${msg} -- Reason given: ${msg}.`)
		})
	})
})
