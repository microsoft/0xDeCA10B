import axios from 'axios';
import { ModelInformation, OriginalData, Storage } from './storage';

export class ServiceStorage implements Storage {
	addOriginalData(transactionHash: string, originalData: OriginalData): Promise<any> {
		return axios.post('/api/data', {
			transactionHash,
			originalData,
		})
	}

	getOriginalData(transactionHash: string): Promise<OriginalData> {
		return axios.get(`/api/data/${transactionHash}`).then(response => {
			const { originalData } = response.data;
			return new OriginalData(originalData.text);
		})
	}

	getModels(afterId?: string, limit?: number): Promise<ModelInformation[]> {
		return axios.get('/api/models').then(response => {
			return response.data.models
		})
	}

	saveModelInformation(modelInformation: ModelInformation): Promise<any> {
		return axios.post('/api/models', modelInformation)
	}

	getModel(modelId: string): Promise<ModelInformation> {
		return axios.get(`/api/models/${modelId}`).then(response => {
			const { model } = response.data;
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
