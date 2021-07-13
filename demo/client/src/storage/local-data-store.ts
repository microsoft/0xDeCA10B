import { DataStore, DataStoreHealthStatus, ModelInformation, ModelsResponse, OriginalData, RemoveResponse } from './data-store'

export class LocalDataStore implements DataStore {
	errorOpening?: boolean

	db?: IDBDatabase

	private readonly dataStoreName = 'data'
	private readonly modelStoreName = 'model'

	constructor() {
		const openRequest = indexedDB.open("database", 1)
		openRequest.onerror = (event: any) => {
			this.errorOpening = true
			console.error("Could not open the database.")
			console.error(event)
			throw new Error("Could not open the database.")
		}

		openRequest.onsuccess = (event: any) => {
			this.db = event.target.result
		}

		openRequest.onupgradeneeded = (event: any) => {
			const db: IDBDatabase = event.target.result

			// Index by transaction hash.
			db.createObjectStore(this.dataStoreName, { keyPath: 'tx' })

			const modelStore = db.createObjectStore(this.modelStoreName, { keyPath: 'address' })
			modelStore.createIndex('address', 'address')
		}
	}

	private checkOpened(timeout = 0): Promise<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				if (this.db) {
					resolve()
				} else if (this.errorOpening) {
					reject(new Error("The database could not be opened."))
				} else {
					this.checkOpened(Math.min(500, 1.618 * timeout + 10))
						.then(resolve)
						.catch(reject)
				}
			}, timeout)
		})
	}

	health(): Promise<DataStoreHealthStatus> {
		return this.checkOpened().then(() => {
			return new DataStoreHealthStatus(true)
		})
	}

	async saveOriginalData(transactionHash: string, originalData: OriginalData): Promise<any> {
		await this.checkOpened()
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(this.dataStoreName, 'readwrite')
			transaction.onerror = reject
			const dataStore = transaction.objectStore(this.dataStoreName)
			const request = dataStore.add({ tx: transactionHash, text: originalData.text })
			request.onerror = reject
			request.onsuccess = resolve
		})
	}

	async getOriginalData(transactionHash: string): Promise<OriginalData> {
		await this.checkOpened()
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(this.dataStoreName, 'readonly')
			transaction.onerror = reject
			const dataStore = transaction.objectStore(this.dataStoreName)
			const request = dataStore.get(transactionHash)
			request.onerror = reject
			request.onsuccess = (event: any) => {
				const originalData = event.target.result
				if (originalData === undefined) {
					reject(new Error("Data not found."))
				} else {
					const { text } = originalData
					resolve(new OriginalData(text))
				}
			}
		})
	}

	async saveModelInformation(modelInformation: ModelInformation): Promise<any> {
		await this.checkOpened()
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(this.modelStoreName, 'readwrite')
			transaction.onerror = reject
			const modelStore = transaction.objectStore(this.modelStoreName)
			const request = modelStore.add(modelInformation)
			request.onerror = reject
			request.onsuccess = resolve
		})
	}

	async getModels(afterAddress?: string, limit?: number): Promise<ModelsResponse> {
		await this.checkOpened()
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(this.modelStoreName, 'readonly')
			transaction.onerror = reject
			const modelStore = transaction.objectStore(this.modelStoreName)
			const index = modelStore.index('address')
			const models: ModelInformation[] = []
			if (afterAddress == null) {
				afterAddress = ''
			}
			const open = true
			const range = IDBKeyRange.lowerBound(afterAddress, open)
			let count = 0
			index.openCursor(range).onsuccess = (event: any) => {
				const cursor = event.target.result
				if (cursor && (limit == null || count++ < limit)) {
					models.push(new ModelInformation(cursor.value))
					cursor.continue()
				} else {
					const countRequest = index.count(range)
					countRequest.onsuccess = () => {
						const remaining = countRequest.result - models.length
						resolve(new ModelsResponse(models, remaining))
					}
				}
			}
		})
	}

	async getModel(_modelId?: number, address?: string): Promise<ModelInformation> {
		if (address === null || address === undefined) {
			throw new Error("An address is required.")
		}
		await this.checkOpened()
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(this.modelStoreName, 'readonly')
			transaction.onerror = reject
			const modelStore = transaction.objectStore(this.modelStoreName)
			const request = modelStore.get(address)
			request.onerror = reject
			request.onsuccess = (event: any) => {
				const model = event.target.result
				if (model === undefined) {
					reject(new Error("Model not found."))
				} else {
					resolve(new ModelInformation(model))
				}
			}
		})
	}

	async removeModel(modelInformation: ModelInformation): Promise<RemoveResponse> {
		await this.checkOpened()
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction(this.modelStoreName, 'readwrite')
			transaction.onerror = reject
			const modelStore = transaction.objectStore(this.modelStoreName)
			const request = modelStore.delete(modelInformation.address)
			request.onerror = reject
			request.onsuccess = () => {
				const success = true
				resolve(new RemoveResponse(success))
			}
		})
	}
}
