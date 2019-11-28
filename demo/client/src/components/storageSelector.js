import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import React from 'react';

export function renderStorageSelector(detailedDescription, currentValue, handleInputChange) {
    return <div>
        <InputLabel htmlFor="storage-selector">
            {`Storage (${detailedDescription})`}
        </InputLabel>
        <Select value={currentValue} onChange={handleInputChange} inputProps={{
            name: 'storageType',
            id: 'storage-selector',
        }}>
            <MenuItem key="storage-select-none" value="none">None (do not store data)</MenuItem>
            <MenuItem key="storage-select-local" value="local">Local (only on this device)</MenuItem>
            <MenuItem key="storage-select-service" value="service">External (a database elsewhere)</MenuItem>
        </Select>
    </div>;
}
