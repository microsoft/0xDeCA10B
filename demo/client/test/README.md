This folder is just for smart contract tests and is used by Truffle.
Other test files go in a `__tests__` folder in the folder with the source code (within the `src/` folder).

`custom-test-env.js` is not a test file.
It is a custom environment for Jest and is in this folder so that it is not picked up by default test file pattern rules.
