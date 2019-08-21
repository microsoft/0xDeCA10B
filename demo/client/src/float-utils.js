const _toFloat = 1E9;

exports.convertNum = function (num, web3, toFloat = _toFloat) {
    return web3.utils.toBN(Math.round(num * toFloat));
}

exports.convertData = function (data, web3, toFloat = _toFloat) {
    return data.map(num => exports.convertNum(num, web3, toFloat));
}
