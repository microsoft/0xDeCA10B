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

safe_math_file="client/contracts/libs/SafeMath.sol"
mkdir --parents `dirname "${safe_math_file}"`
wget https://github.com/OpenZeppelin/openzeppelin-solidity/raw/1fd993bc01890bf6bd974aaf3d709bdf0a79b9bf/contracts/math/SafeMath.sol --output-document "${safe_math_file}"
# Change the first line to use the right compiler version.
sed -i "1s/.*/pragma solidity ^0.5;/" "${safe_math_file}"

safe_math_file="client/contracts/libs/SignedSafeMath.sol"
mkdir --parents `dirname "${safe_math_file}"`
wget https://github.com/OpenZeppelin/openzeppelin-solidity/raw/1fd993bc01890bf6bd974aaf3d709bdf0a79b9bf/contracts/drafts/SignedSafeMath.sol --output-document "${safe_math_file}"
# Change the first line to use the right compiler version.
sed -i "1s/.*/pragma solidity ^0.5;/" "${safe_math_file}"
