const Environment = require('jest-environment-jsdom');

/**
 * A custom environment to set the TextEncoder that is required by TensorFlow.js.
 */
module.exports = class CustomTestEnvironment extends Environment {
    // Following https://stackoverflow.com/a/57713960/1226799
    async setup() {
        await super.setup();
        if (typeof this.global.TextEncoder === 'undefined') {
            const { TextEncoder } = require('util');
            this.global.TextEncoder = TextEncoder;
        }
        if (typeof this.global.indexedDB === 'undefined') {
            this.global.indexedDB = require('fake-indexeddb');
        }
        if (typeof this.global.IDBKeyRange === 'undefined') {
            this.global.IDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange")
        }
    }
}
