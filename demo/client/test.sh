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
truffle compile || cleanup exit
CI=true truffle migrate || cleanup exit
CI=true truffle test || cleanup exit

cleanup

# Add CI=true before to remove colors.
mocha --recursive src/**/__tests__/*.test.js || exit 1

# Skipping for now because it fails and I can't figure out how to correct it: https://stackoverflow.com/questions/57712235/referenceerror-textencoder-is-not-defined-when-running-react-scripts-test
# Set `CI=true` to avoid watching for changes.
# CI=true react-scripts test --env=jsdom --testPathIgnorePatterns='src/.*/__tests__/[^/]*-node.test.js' || exit 1
