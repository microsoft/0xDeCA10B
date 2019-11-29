import { DataStore } from './data-store'
import { LocalDataStore } from './local-data-store'
import { ServiceDataStore } from './service-data-store'

export class DataStoreFactory {
	/**
	 * Singleton.
	 */
	private static all: Record<string, DataStore>

	create(storageType: 'local' | 'service'): DataStore {
		switch (storageType) {
			case 'local':
				return new LocalDataStore()
			case 'service':
				return new ServiceDataStore()
		}
	}

	static getAll(): Record<string, DataStore> {
		if (!DataStoreFactory.all) {
			const factory = new DataStoreFactory()
			DataStoreFactory.all = {
				local: factory.create('local'),
				service: factory.create('service'),
			}
		}
		return DataStoreFactory.all
	}
}
