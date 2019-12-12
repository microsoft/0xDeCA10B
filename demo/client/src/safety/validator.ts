import Web3 from 'web3'
import config from './config'

export class OnlineSafetyValidator {
    private enabled: boolean = process.env.REACT_APP_ENABLE_ONLINE_SAFETY === undefined
        || process.env.REACT_APP_ENABLE_ONLINE_SAFETY.toLowerCase() === 'true'
    private web3: Web3
    private verified: Set<string>

    constructor(web3: Web3) {
        this.web3 = web3
        this.verified = new Set(config.verified.map(obj => this.normalize(obj.network, obj.address)))
    }

    private normalize(networkType: string, address: string): string {
        // Assume addresses are valid and do not have any '-'s.
        return `${networkType}-${address.toLowerCase()}`
    }

    async isPermitted(address: string): Promise<boolean> {
        if (!this.enabled) {
            // Everything is permitted.
            return true
        }
        const networkType = await this.web3.eth.net.getNetworkType()
        return this.verified.has(this.normalize(networkType, address))
    }
}
