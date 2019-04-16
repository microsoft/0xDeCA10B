# dML Dashboard
[![Build Status](https://dev.azure.com/maluuba/dML/_apis/build/status/%5BdML%5D%20Test?branchName=master)](https://dev.azure.com/maluuba/dML/_build/latest?definitionId=77?branchName=master)

A dashboard and examples for deploying updatable AI models to Ethereum.

<img src="./assets/architecture_flow.png?raw=true" width=500 alt="Picture of a someone sending data to the addData method in CollaborativeTrainer which sends data to the 3 main components as further described next.">

Adding data consists of 3 steps.
1. The **IncentiveMechanism** validates the transaction, for instance, in some cases a "stake" or deposit is required.
2. The **DataHandler** stores the data onto the blockchain. This ensures that it is accessible for all future uses, not limited to this smart contract.
3. The machine learning **model** is updated according to predefined training algorithms. In addition to adding data, anyone can query the model for predictions, and the incentive mechanism may be triggered to provide users with payments or virtual "karma" points.

This repository also contains Solidity examples for models, data handlers, and incentive mechanisms for deploying models that are free to use for inference as initially proposed in the paper [Decentralized & Collaborative AI on Blockchain Platforms][overview-paper], [dark theme version here][overview-paper-dark].

This project is made from a React project with Truffle added. This [Truffle example][truffle-react] was used to help add Truffle.

# Setup
The following steps are made for Linux and require `npm`. They do work in WSL.

Run
```bash
./setup.sh
```

## Docker Setup
You can use Docker by running:
```bash
docker build -t dml .
docker run --rm -it -p 7545:7545 -v ${PWD}:/root/workspace/dashboard --name dml dml bash
# You may have to run `./setup.sh` in the container to ensure that everything is set up properly.
```

## Troubleshooting Setup
If you have problems running the setup steps related to node-gyp, then you might need to set Python 2.7 to be your default. Recommendation: Set up a Python 2.7 Conda environment and activate it.

## Update
To update dependencies after already setting up:
```bash
yarn global upgrade ethlint ganache-cli truffle yarn && yarn upgrade && (cd client && yarn upgrade)
```

## Linting
### Solidity Files
We use [Ethlint][ethlint] for linting.
To check the contract code run:
```bash
yarn lint
```

Proper linting will be enforced when making a pull request.

# Deploy
## Blockchain
Start the blockchain (Ganache) in one termanial.
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

You shouldn't need to if you've been consistenly using a blockchain for just this project but you can also try changing the network ID for Ganache. This can be done in the Ganache UI or CLI (--networkId).

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
Run `yarn test`.
The blockchain will be started and stopped so it's best not to have a blockchain running at the same address and port (e.g. one running through `yarn blockchain`).

[ethlint]: https://github.com/duaraghav8/Ethlint
[overview-paper]: https://aka.ms/0xDeCA10B-paper
[overview-paper-dark]: https://aka.ms/0xDeCA10B-paper-dark

# Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
