#!/bin/bash

# Enable job control with -m so that the blockchain can be killed.
set -emx

pushd ..
yarn blockchain & bc_pid=$!
sleep 1s
popd

cleanup() {
    kill -9 -${bc_pid}
    if [ "$1" == "exit" ]; then
        exit 1
    fi
}

# The `set -e` at the top doesn't seem to help with getting these exit on failure.
# Default to development environment.
export NODE_ENVIRONMENT=${NODE_ENVIRONMENT:-development}
truffle compile || cleanup exit
CI=true truffle migrate || cleanup exit
CI=true truffle test test/contracts/*.js test/contracts/**/*.js || cleanup exit

# Set `CI=true` to avoid watching for changes.
CI=true react-scripts test --env='./test/custom-test-env.js' --testPathIgnorePatterns='src/.*/__tests__/[^/]*-node.test.js' || cleanup exit

cleanup

# Add CI=true before to remove colors.
mocha --recursive './src/**/__tests__/*-node.test.js' || exit 1
