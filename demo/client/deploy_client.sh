#!/bin/bash

set -e

truffle compile
truffle migrate

react-scripts start
