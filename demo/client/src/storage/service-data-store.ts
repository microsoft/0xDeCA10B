import axios from 'axios';
import { DataStore, ModelInformation, OriginalData } from './data-store';

if (process.env.NODE_ENV === 'production' && axios.defaults.baseURL === undefined && process.env.BACK_END_URL) {
	axios.defaults.baseURL = process.env.BACK_END_URL;
}

export class ServiceDataStore implements DataStore {
	saveOriginalData(transactionHash: string, originalData: OriginalData): Promise<any> {
		return axios.post('/api/data', {
			transactionHash,
			originalData,
		})
	}

	getOriginalData(transactionHash: string): Promise<OriginalData> {
		return axios.get(`/api/data/${transactionHash}`).then(response => {
			const { originalData } = response.data;
			const {text} = originalData;
			return new OriginalData(text);
		})
	}

	saveModelInformation(modelInformation: ModelInformation): Promise<any> {
		return axios.post('/api/models', modelInformation)
	}

	getModels(afterId?: string, limit?: number): Promise<ModelInformation[]> {
		return axios.get('/api/models').then(response => {
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
		return axios.get(`/api/models/${modelId}`).then(response => {
			const { model } = response.data;
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
			);
		});
	}
}
