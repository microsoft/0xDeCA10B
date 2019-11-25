import { ServiceStorage } from './service-storage';
import { Storage } from './storage';

export enum StorageType {
	SERVICE
}

export class StorageFactory {
	create(storageType: StorageType): Storage {
		switch (storageType) {
			case StorageType.SERVICE:
				return new ServiceStorage()
		}
	}
}
