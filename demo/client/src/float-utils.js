const _toFloat = 1E9;

export function convertNum(num, web3, toFloat = _toFloat) {
    return web3.utils.toBN(Math.round(num * toFloat));
}

export function convertToHex(num, web3, toFloat = _toFloat) {
    return web3.utils.toHex(Math.round(num * toFloat));
}

export function convertData(data, web3, toFloat = _toFloat) {
    return data.map(num => convertNum(num, web3, toFloat));
}

export function convertDataToHex(data, web3, toFloat = _toFloat) {
    return data.map(num => convertToHex(num, web3, toFloat));
}
