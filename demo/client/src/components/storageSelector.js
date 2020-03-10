import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'
import Select from '@material-ui/core/Select'
import Tooltip from '@material-ui/core/Tooltip'
import React from 'react'

export function checkStorages(storages) {
    return Promise.all(Object.entries(storages).map(([key, storage]) => {
        return storage.health().then(status => {
            if (status.healthy) {
                return key;
            } else if (status.details.err) {
                console.warn(`${key} data is not available.`);
                console.warn(status.details.err)
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
        <Tooltip placement="top-start"
              title={detailedDescription}>
        <InputLabel htmlFor="storage-selector">
            {`Storage`}
        </InputLabel>
        </Tooltip>
        <Select value={currentValue} onChange={handleInputChange} inputProps={{
            name: 'storageType',
            id: 'storage-selector',
        }}>
            {permittedStorageTypes.indexOf('none') >= 0 &&
                <MenuItem key="storage-select-none" value="none">None (do not store data)</MenuItem>
            }
            {permittedStorageTypes.indexOf('local') >= 0 &&
                <MenuItem key="storage-select-local" value="local">Local (only on this device)</MenuItem>
            }
            {permittedStorageTypes.indexOf('service') >= 0 &&
                <MenuItem key="storage-select-service" value="service">External (a database elsewhere)</MenuItem>
            }
        </Select>
    </div>
}
