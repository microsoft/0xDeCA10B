#!/bin/bash

set -e

# Default to development environment.
export NODE_ENVIRONMENT=${NODE_ENVIRONMENT:-development}

truffle compile
truffle migrate

react-scripts start
