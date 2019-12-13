import assert from 'assert'
import { OnlineSafetyValidator } from '../validator'


describe("OnlineSafetyValidator", () => {
    it("should validate", async () => {
        const validator = new OnlineSafetyValidator()
        // This is the example in the config but it might also pass
        // because online safety is disabled by an environment variable.
        const network = "private"
        const address = "0x1b88938102bE9ED97a0e9b8Cb321dD89C60e86Ab"
        assert(validator.isPermitted(network, address) === true)
    })
})
