exports.assertCloseToNumbers = function (actual, expected, delta,
    web3, 
    messagePrefix) {
	messagePrefix = messagePrefix ? messagePrefix + ": " : ""
	if (web3.utils.isBN(actual)) {
		if (web3.utils.isBN(expected)) {
			const message = `${messagePrefix}actual (BN): ${actual} (${typeof actual})\nexpected (BN): ${expected} (${typeof expected})\ndelta: ${delta}`
			assert(actual.sub(expected).abs().lte(web3.utils.toBN(delta)), message)
		} else {
			const expectedBN = web3.utils.toBN(expected)
			const message = `${messagePrefix}actual (BN): ${actual} (${typeof actual})\nexpected: ${expected} (${typeof expected}) => BN: ${expectedBN}\ndelta: ${delta}`
			assert(actual.sub(expectedBN).abs().lte(web3.utils.toBN(delta)), message)
		}
	} else if (web3.utils.isBN(expected)) {
		const actualBN = web3.utils.toBN(actual)
		const message = `${messagePrefix}actual: ${actual} (${typeof actual}) => BN: ${actualBN}\nexpected (BN): ${expected} (${typeof expected})\ndelta: ${delta}`
		assert(actualBN.sub(expected).abs().lte(web3.utils.toBN(delta)), message)
	} else {
		if (typeof actual === 'string') {
			actual = parseInt(actual)
		}
		assert.closeTo(actual, expected, delta, messagePrefix)
	}
}

exports.assertEqualNumbers = function (actual, expected,
    web3, 
    messagePrefix) {
	messagePrefix = messagePrefix ? messagePrefix + ": " : ""
	if (web3.utils.isBN(actual)) {
		if (web3.utils.isBN(expected)) {
			const message = `${messagePrefix}actual (BN): ${actual} (${typeof actual})\nexpected: ${expected} (${typeof expected})`
			assert(actual.eq(expected), message)
		} else {
			const expectedBN = web3.utils.toBN(expected)
			const message = `${messagePrefix}actual (BN): ${actual} (${typeof actual})\nexpected: ${expected} (${typeof expected}) => BN: ${expectedBN}`
			assert(actual.eq(expectedBN), message)
		}
	} else if (web3.utils.isBN(expected)) {
		const actualBN = web3.utils.toBN(actual)
		const message = `${messagePrefix}actual: ${actual} (${typeof actual}) => BN: ${actualBN}\nexpected (BN): ${expected} (${typeof expected})`
		assert(actualBN.eq(expected), message)
	} else {
		if (typeof actual === 'string') {
			actual = parseInt(actual)
		}
		assert.equal(actual, expected, messagePrefix)
	}
}
