import * as _getWeb3 from '@drizzle-utils/get-web3'
import Web3 from "web3" // Only required for custom/fallback provider option.

export async function getWeb3() {
    if (window.ethereum) {
        // Get rid of a warning about network refreshing.
        window.ethereum.autoRefreshOnNetworkChange = false
    }
    // TODO Fallback to Ethereum mainnet.
    const fallbackProvider = new Web3.providers.HttpProvider("http://127.0.0.1:7545")
    const result = await _getWeb3({ fallbackProvider, requestPermission: true })
    return result
}
