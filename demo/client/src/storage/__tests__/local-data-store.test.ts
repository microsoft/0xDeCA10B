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
			description: 'description', modelType: 'modelType', encoder: 'encoder'
		})
		db.saveModelInformation(modelInfo)
		const response = await db.getModels(undefined, 1)
		const { models, remaining } = response
		assert.deepStrictEqual(models, [modelInfo])
		assert(remaining === 0)

		const model = await db.getModel(modelInfo.id, modelInfo.address)
		assert.deepStrictEqual(model, modelInfo)

		await db.removeModel(modelInfo)
		assert((await db.getModels()).models.length === 0)
	})

	it("should find original data", async () => {
		const transactionHash = 'txHash'
		const originalData = new OriginalData('text')
		db.saveOriginalData(transactionHash, originalData)
		const found = await db.getOriginalData(transactionHash)
		assert.deepStrictEqual(found, originalData)
	})
})
