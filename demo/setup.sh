#!/bin/bash

set -ex

if [ "${CI}" == "true" ]; then
    # Don't do globally in Azure pipeline because of permissions issues.
    npm install yarn
else
    npm install -g yarn
fi

yarn install
(cd client && yarn install)

./setup_libs.sh
