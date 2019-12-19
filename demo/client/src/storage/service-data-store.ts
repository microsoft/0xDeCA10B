import axios from 'axios'
import { DataStore, DataStoreHealthStatus, ModelInformation, ModelsResponse, OriginalData, RemoveResponse } from './data-store'

export class ServiceDataStore implements DataStore {
	url: string = ''

	constructor(url?: string) {
		if (url !== undefined) {
			this.url = url
		} else if (process.env.NODE_ENV === 'production' && process.env.BACK_END_URL) {
			this.url = process.env.BACK_END_URL
		}
	}

	async health(): Promise<DataStoreHealthStatus> {
		if (process.env.REACT_APP_ENABLE_SERVICE_DATA_STORE === undefined
			|| process.env.REACT_APP_ENABLE_SERVICE_DATA_STORE.toLocaleLowerCase() === 'true') {
			return axios.get(this.url + '/api/health', { timeout: 1000 }).then(response => {
				const { healthy } = response.data
				return new DataStoreHealthStatus(healthy, { url: this.url })
			}).catch(err => {
				return new DataStoreHealthStatus(false, { err })
			})
		} else {
			return new DataStoreHealthStatus(false, { reason: "Disabled" })
		}
	}

	saveOriginalData(transactionHash: string, originalData: OriginalData): Promise<any> {
		return axios.post(this.url + '/api/data', {
			transactionHash,
			originalData,
		})
	}

	getOriginalData(transactionHash: string): Promise<OriginalData> {
		return axios.get(`${this.url}/api/data/${transactionHash}`).then(response => {
			const { originalData } = response.data
			const { text } = originalData
			return new OriginalData(text)
		})
	}

	saveModelInformation(modelInformation: ModelInformation): Promise<any> {
		return axios.post(this.url + '/api/models', modelInformation)
	}

	getModels(afterAddress?: string, limit?: number): Promise<ModelsResponse> {
		const params = []
		if (afterAddress != null) {
			params.push(`afterAddress=${afterAddress}`)
		}
		if (limit != null) {
			params.push(`limit=${limit}`)
		}
		const url = `${this.url}/api/models?${params.join('&')}`
		return axios.get(url).then(response => {
			const models = response.data.models.map((model: any) => new ModelInformation(model))
			const { remaining } = response.data
			return new ModelsResponse(models, remaining)
		})
	}

	getModel(modelId?: number, address?: string): Promise<ModelInformation> {
		const params = []
		if (modelId != null) {
			params.push(`modelId=${modelId}`)
		}
		if (address != null) {
			params.push(`address=${address}`)
		}
		return axios.get(`${this.url}/api/model?${params.join('&')}`).then(response => {
			const { model } = response.data
			if (address !== null && address !== undefined && model.address !== address) {
				throw new Error("Could not find a model with the matching address.")
			}
			return new ModelInformation(model)
		})
	}

	removeModel(modelInformation: ModelInformation): Promise<RemoveResponse> {
		// Requires permission validation from the server.
		throw new Error("Not implemented")
	}
}
