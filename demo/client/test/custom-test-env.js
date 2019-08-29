const Environment = require('jest-environment-jsdom');
const { TextEncoder } = require('util')

/**
 * A custom environment to set the TextEncoder that is required by TensorFlow.js.
 */
module.exports = class CustomTestEnvironment extends Environment {
    async setup() {
        await super.setup();
        this.global.TextEncoder = TextEncoder;
    }
}
