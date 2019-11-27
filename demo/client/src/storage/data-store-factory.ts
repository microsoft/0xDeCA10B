import { DataStore } from './data-store';
import { LocalDataStore } from './local-data-store';
import { ServiceDataStore } from './service-data-store';

export class DataStoreFactory {
	create(storageType: 'local' | 'service'): DataStore {
		switch (storageType) {
			case 'local':
				return new LocalDataStore()
			case 'service':
				return new ServiceDataStore()
		}
	}
}
