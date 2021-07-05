#!/bin/bash

set -ex

# Get some libraries from OpenZeppelin.
# Can't install these through npm since they use the 0.5 version of solidity.

commit="04a1b21874e02fd3027172bf208d9658b886b658"

safe_math_file="client/lib/SafeMath.sol"
mkdir --parents `dirname "${safe_math_file}"`
wget "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/${commit}/contracts/math/SafeMath.sol" --output-document "${safe_math_file}"

signed_safe_math_file="client/lib/SignedSafeMath.sol"
mkdir --parents `dirname "${signed_safe_math_file}"`
wget "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/${commit}/contracts/drafts/SignedSafeMath.sol" --output-document "${signed_safe_math_file}"

# Change the first line to use the right compiler version.
sed -i "1s/.*/pragma solidity ^0.6;/" "${safe_math_file}" "${signed_safe_math_file}"
