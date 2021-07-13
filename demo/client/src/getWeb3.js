import * as _getWeb3 from '@drizzle-utils/get-web3'
import Web3 from 'web3' // Only required for custom/fallback provider option.

export async function getWeb3() {
	if (typeof window !== "undefined" && window.ethereum) {
		// Get rid of a warning about network refreshing.
		window.ethereum.autoRefreshOnNetworkChange = false
	}
	// Fallback to Ethereum mainnet.
	// Address copied from MetaMask.
	const fallbackProvider = new Web3.providers.HttpProvider("https://api.infura.io/v1/jsonrpc/mainnet")
	const result = await _getWeb3({ fallbackProvider, requestPermission: true })
	return result
}

export async function getNetworkType() {
	if (typeof window !== "undefined" && window.ethereum) {
		// Get rid of a warning about network refreshing.
		window.ethereum.autoRefreshOnNetworkChange = false
	}
	return _getWeb3().then(web3 => {
		return web3.eth.net.getNetworkType()
	}).catch(err => {
		console.warn("Error getting the network type.")
		console.warn(err)
		alert("Could not find an Ethereum wallet provider so mainnet will be used")
		// Assume mainnet
		return 'main'
	})
}
