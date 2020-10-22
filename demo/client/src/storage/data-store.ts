/**
 * Information about a shared model.
 */
export class ModelInformation {
	id?: number
	name: string
	address: string
	description: string
	modelType: string
	encoder: string
	accuracy?: number

	constructor(obj: any) {
		this.id = obj.id
		this.name = obj.name
		this.address = obj.address
		this.modelType = obj.modelType
		this.description = obj.description
		this.encoder = obj.encoder
		this.accuracy = obj.accuracy
	}
}

/**
 * A response when getting models.
 */
export class ModelsResponse {
	/**
	 * The models matching the request.
	 */
	models: ModelInformation[]

	/**
	 * The number of remaining models for the query. This does not count the models in `models`.
	 */
	remaining: number

	constructor(models: ModelInformation[], remaining: number) {
		this.models = models
		this.remaining = remaining
	}
}

export class RemoveResponse {
	success: boolean

	constructor(success: boolean) {
		this.success = success
	}
}

export class OriginalData {
	constructor(public text: string) {		
	}
}

export class DataStoreHealthStatus {
	healthy: boolean
	details: any

	constructor(healthy: boolean, details?: any) {
		this.healthy = healthy
		this.details = details
		if (this.details === undefined) {
			this.details = {}
		}
	}
}

/**
 * Interact with the storage of model and data information.
 */
export interface DataStore {
	health(): Promise<DataStoreHealthStatus>

	saveOriginalData(transactionHash: string, originalData: OriginalData): Promise<any>
	getOriginalData(transactionHash: string): Promise<OriginalData>

	saveModelInformation(modelInformation: ModelInformation): Promise<any>

	getModels(afterAddress?: string, limit?: number): Promise<ModelsResponse>
	getModel(modelId?: number, address?: string): Promise<ModelInformation>

	removeModel(modelInformation: ModelInformation): Promise<RemoveResponse>
}
