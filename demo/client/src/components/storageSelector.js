import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import React from 'react';

export function checkStorages(storages) {
    return Promise.all(Object.entries(storages).map(([key, storage]) => {
        return storage.health().then(status => {
            if (status.healthy) {
                return key;
            } else {
                console.warn(`${key} data is not available.`);
            }
        }).catch(err => {
            console.warn(`${key} data is not available.`);
            console.warn(err);
        })
    }));
}

export function renderStorageSelector(detailedDescription, currentValue, handleInputChange, permittedStorageTypes) {
    if (currentValue !== 'none' && permittedStorageTypes.indexOf(currentValue) < 0) {
        // `currentValue` is invalid. Avoid a warning.
        currentValue = ''
    }
    return <div>
        <InputLabel htmlFor="storage-selector">
            {`Storage (${detailedDescription})`}
        </InputLabel>
        <Select value={currentValue} onChange={handleInputChange} inputProps={{
            name: 'storageType',
            id: 'storage-selector',
        }}>
            <MenuItem key="storage-select-none" value="none">None (do not store data)</MenuItem>
            {permittedStorageTypes.indexOf('local') >= 0 &&
                <MenuItem key="storage-select-local" value="local">Local (only on this device)</MenuItem>
            }
            {permittedStorageTypes.indexOf('service') >= 0 &&
                <MenuItem key="storage-select-service" value="service">External (a database elsewhere)</MenuItem>
            }
        </Select>
    </div>;
}
