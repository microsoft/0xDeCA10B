const _toFloat = 1E9;

export function convertNum(num, _web3, toFloat = _toFloat) {
    // We used to convert to BN here
    // but it caused problems and inconsistencies when running tests vs. running in the browser (using MetaMask).
    return Math.round(num * toFloat);
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
