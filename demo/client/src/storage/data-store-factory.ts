import { DataStore } from './data-store';
import { LocalDataStore } from './local-data-store';
import { ServiceDataStore } from './service-data-store';

export enum DataStoreType {
	LOCAL,
	SERVICE,
}

export class DataStoreFactory {
	create(storageType: DataStoreType): DataStore {
		switch (storageType) {
			case DataStoreType.LOCAL:
				return new LocalDataStore()
			case DataStoreType.SERVICE:
				return new ServiceDataStore()
		}
	}
}
