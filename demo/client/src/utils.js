const util = require('util')

exports.setTimeoutPromise = util.promisify(setTimeout)
