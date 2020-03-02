/**
 * Help validate if a contract can be used with the system.
 */
export class ContractValidator {
    /**
     * 
     * @param address The address of the main entry point contract.
     */
    async isValid(address: string): Promise<boolean> {
        if (!address || address.length === 0) {
            return false
        }

        // TODO

        return true
    }
}
