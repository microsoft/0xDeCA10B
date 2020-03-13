import config from './config'

export class OnlineSafetyValidator {
	private enabled: boolean = process.env.REACT_APP_ENABLE_ONLINE_SAFETY !== undefined
		&& process.env.REACT_APP_ENABLE_ONLINE_SAFETY.toLocaleLowerCase('en') === 'true'
	private verified: Set<string>

	constructor() {
		this.verified = new Set(config.verified.map(obj => this.normalize(obj.network, obj.address)))
	}

	private normalize(networkType: string, address: string): string {
		// Assume addresses are valid and do not have any '-'s.
		return `${networkType}-${address.toLocaleLowerCase('en')}`
	}

	isEnabled(): boolean {
		return this.enabled
	}

	isPermitted(networkType: string, address: string): boolean {
		if (!this.enabled) {
			// Everything is permitted.
			return true
		}
		return this.verified.has(this.normalize(networkType, address))
	}
}
