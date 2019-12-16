import assert from 'assert'
import { DataStoreHealthStatus, ModelInformation, OriginalData } from '../data-store'
import { DataStoreFactory } from '../data-store-factory'

describe("LocalDataStore", () => {
    const db = new DataStoreFactory().create('local')
    it("should be healthy", async () => {
        const status = await db.health()
        assert.deepStrictEqual(status, new DataStoreHealthStatus(true))
    })

    it("should find models", async () => {
        const modelInfo = new ModelInformation({
            name: 'name', address: 'address',
            description: 'description', modelType: 'modelType', encoder: 'encoder')
        db.saveModelInformation(modelInfo)
        const models = await db.getModels('address', 1)
        assert.deepStrictEqual(models, [modelInfo])

        const model = await db.getModel(modelInfo.id, modelInfo.address)
        assert.deepStrictEqual(model, modelInfo)
    })

    it("should find original data", async () => {
        const transactionHash = 'txHash'
        const originalData = new OriginalData('text')
        db.saveOriginalData(transactionHash, originalData)
        const found = await db.getOriginalData(transactionHash)
        assert.deepStrictEqual(found, originalData)
    })
})
