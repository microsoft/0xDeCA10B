/**
 * Information about a shared model.
 */
export class ModelInformation {
	id: string
	name: string
	address: string
	description: string
	modelType: string
	encoder: string
	accuracy: number

	constructor(id: string,
		name: string,
		address: string,
		description: string,
		modelType: string,
		encoder: string,
		accuracy: number, ) {
		this.id = id
		this.name = name
		this.address = address
		this.modelType = modelType
		this.description = description
		this.encoder = encoder
		this.accuracy = accuracy
	}
}

export class OriginalData {
	text?: string

	constructor(text?: string) {
		this.text = text
	}
}

/**
 * Interact with the storage of model and data information.
 */
export interface DataStore {
	saveOriginalData(transactionHash: string, originalData: OriginalData): Promise<any>
	getOriginalData(transactionHash: string): Promise<OriginalData>

	saveModelInformation(modelInformation: ModelInformation): Promise<any>

	getModels(afterId?: string, limit?: number): Promise<ModelInformation[]>
	getModel(modelId?: string, address?: string): Promise<ModelInformation>
}
