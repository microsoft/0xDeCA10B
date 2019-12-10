import axios from 'axios'
import { DataStore, DataStoreHealthStatus, ModelInformation, OriginalData } from './data-store'

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
		if (process.env.REACT_APP_DISABLE_SERVICE_DATA_STORE === undefined
			|| process.env.REACT_APP_DISABLE_SERVICE_DATA_STORE.toLocaleLowerCase() === 'false') {
			return axios.get(this.url + '/api/health').then(response => {
				const { healthy } = response.data
				return new DataStoreHealthStatus(healthy, { url: this.url })
			})
		} else {
			return new DataStoreHealthStatus(false, { reason: "disabled" })
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

	getModels(afterId?: string, limit?: number): Promise<ModelInformation[]> {
		return axios.get(this.url + '/api/models').then(response => {
			return response.data.models.map((model: any) => new ModelInformation(
				model.id,
				model.name,
				model.address,
				model.description,
				model.modelType,
				model.encoder,
				model.accuracy,
			))
		})
	}

	getModel(modelId?: string, address?: string): Promise<ModelInformation> {
		return axios.get(`${this.url}/api/model?modelId=${modelId}&address=${address}`).then(response => {
			const { model } = response.data
			if (address !== null && address !== undefined && model.address !== address) {
				throw new Error("Could not find a model with the matching address.")
			}
			return new ModelInformation(
				model.id,
				model.name,
				model.address,
				model.description,
				model.modelType,
				model.encoder,
				model.accuracy,
			)
		})
	}
}
