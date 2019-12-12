import Web3 from 'web3'
import { OnlineSafetyValidator } from '../validator'

describe("OnlineSafetyValidator", () => {
    it("should load", async () => {
        new OnlineSafetyValidator(new Web3())
    })
})
