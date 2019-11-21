# Decentralized & Collaborative AI on Blockchain Demo
[![Build Status](https://dev.azure.com/maluuba/0xDeCA10B/_apis/build/status/demo-CI?branchName=master)](https://dev.azure.com/maluuba/0xDeCA10B/_build/latest?definitionId=116&branchName=master)

A dashboard and examples for deploying updatable AI models to Ethereum. A video demo is available There is a video example showing how to deploy <a href="https://aka.ms/0xDeCA10B-demo" target="_blank">here</a>.

This folder also contains Solidity examples for models, data handlers, and incentive mechanisms for deploying models that are free to use for inference as initially proposed in our introductory paper.

This project is made from a React project with Truffle added. This [Truffle example][truffle-react] was used to help add Truffle.

This work in its current form is just meant as an example and proof of concept.
It is not ready to be deployed for production yet.

# Setup
This section explains how to set up locally on Linux/WSL, alternatively, you can skip ahead and use a Docker image.

The following steps are made for Linux and require `npm`. They do work in WSL.

Run
```bash
./setup.sh
```

## Docker Setup
You can use a Docker image by running:
```bash
docker run --rm -it -p 3000:3000 -p 5387:5387 -p 7545:7545 -v ${PWD}:/root/workspace/demo -v /root/workspace/demo/node_modules -v /root/workspace/demo/client/node_modules --name decai-demo mcr.microsoft.com/samples/blockchain-ai/0xdeca10b-demo bash

# If this is your first time setting up then run:
./setup_libs.sh

# So that you can start a few processes in the Docker container, run:
byobu
```

You can find the available tags for the Docker image [here](https://mcr.microsoft.com/v2/samples/blockchain-ai/0xdeca10b-demo/tags/list) and check the details for the latest tag [here](https://mcr.microsoft.com/v2/samples/blockchain-ai/0xdeca10b-demo/manifests/latest).

### Building the Docker Image
If you want to build your own fresh image:
```bash
docker build -t decai-demo .
```

#### (Microsoft Devs) Updating the Public Image
First get permission to push 0xdeca10bcontainerreg.azurecr.io.

Then
```bash
docker login 0xdeca10bcontainerreg.azurecr.io
newVersion=<Set the new version. E.g. 1.2.0>
docker tag decai-demo 0xdeca10bcontainerreg.azurecr.io/public/samples/blockchain-ai/0xdeca10b-demo:${newVersion}
docker tag decai-demo 0xdeca10bcontainerreg.azurecr.io/public/samples/blockchain-ai/0xdeca10b-demo:latest
docker push 0xdeca10bcontainerreg.azurecr.io/public/samples/blockchain-ai/0xdeca10b-demo:${newVersion}
docker push 0xdeca10bcontainerreg.azurecr.io/public/samples/blockchain-ai/0xdeca10b-demo:latest
```

## Troubleshooting Setup
If you have problems running the setup steps related to node-gyp, then you might need to set Python 2.7 to be your default. Recommendation: Set up a Python 2.7 Conda environment and activate it.

## Update
To update dependencies after already setting up:
```bash
yarn global add yarn && yarn install && (cd client && yarn install)
```

# Deploy
There is a video example showing how to deploy <a href="https://aka.ms/0xDeCA10B-deploy" target="_blank">here</a>.

## Blockchain
Start the blockchain (Ganache) in one terminal.
Run:
```bash
yarn blockchain
```

Do once:
* Add http://localhost:7545 to MetaMask.
* Copy the first private key output.
* Use that private key to create a new account in MetaMask.

## Server
Start the server in one terminal.
Run:
```bash
yarn server
```

## Client
Then in another terminal.
Run:
```bash
yarn client
```

## Troubleshooting Deployment
### Blockchain Issues
Run `yarn clean` to delete your local blockchain and cached contracts. This will delete any transactions done but should make everything work again.

### Errors about a contract not found at a certain address
If you get errors about calling a contract then it's probably because you restarted your blockchain (Ganache) and the contract doesn't exist anymore on the blockchain.
This would happen if you restarted your computer.
You have to delete the generated .json files that keep track of contract addresses:
```bash
rm -f client/{build,src}/contracts/*.json
```
Then you should be able to deploy normally.

You can also try to `rm -rf blockchain_db` to delete your blockchain and restart from scratch.

### MetaMask Issues
#### Issues about nonce
If MetaMask gives issues about the nonce not being right for a transaction then it's probably because you restarted your blockchain but MetaMask caches some basic things on the URL and the network ID.

You can first try to reset your account in the MetaMask settings. This will clear your transaction history.

You shouldn't need to if you've been consistently using a blockchain for just this project but you can also try changing the network ID for Ganache. This can be done in the Ganache UI or CLI (--networkId).

#### MetaMask Loading Issues
If MetaMask is spinning and non-responsive:
1. Disable the extension here: chrome://extensions
2. Re-enable the extension.
3. Open the extension.
4. Change the network to use. E.g. Select Main Ethereum Network.
5. Log in to MetaMask.
6. Change the network back to the custom one.
7. Reject any queued transactions.

If you get the spinning issue again, then also try following the steps above with resetting your account as well as restarting the blockchain by:
1. Stop the `yarn blockchain` process.
2. Run `yarn clean`.
3. Run `yarn blockchain`.

[ganache]: https://truffleframework.com/ganache
[truffle-react]: https://truffleframework.com/boxes/react

# Testing
To simply run all tests:
```bash
yarn test
```

A local blockchain will be started and stopped so it's best not to have a blockchain running at the same address and port (e.g. one running through `yarn blockchain`).

## Running Specific Tests
To run specific smart contract tests and save time by not waiting for Truffle migrations:
* In one terminal, start a blockchain: `yarn blockchain`
* In another terminal session, run:
```bash
cd client
npx truffle test [<test file paths>] --network skipMigrations
# For example:
npx truffle test test/contracts/*.js test/contracts/**/*.js --network skipMigrations
```

# Linting
### Solidity Files
We use [Ethlint][ethlint] for linting and enforce it on pull requests.
To check the contract code run:
```bash
yarn lint
```

[deploy-video]: https://aka.ms/0xDeCA10B-deploy
[demo-video]: https://aka.ms/0xDeCA10B-demo

[ethlint]: https://github.com/duaraghav8/Ethlint
[overview-paper]: https://aka.ms/0xDeCA10B-paper
[overview-paper-dark]: https://aka.ms/0xDeCA10B-paper-dark
