# Decentralized & Collaborative AI on Blockchain

<!-- Put horizontally since build status badges are normally horizontal. -->
| [Demo][demo-folder] | [Simulation][simulation-folder] | Security |
|:-:|:-:|:-:|
| [![Build Status](https://dev.azure.com/maluuba/0xDeCA10B/_apis/build/status/demo-CI?branchName=master)](https://dev.azure.com/maluuba/0xDeCA10B/_build/latest?definitionId=116&branchName=master) | [![Build Status](https://dev.azure.com/maluuba/0xDeCA10B/_apis/build/status/simulation-CI?branchName=master)](https://dev.azure.com/maluuba/0xDeCA10B/_build/latest?definitionId=117&branchName=master) | [![Build Status](https://dev.azure.com/maluuba/0xDeCA10B/_apis/build/status/Security%20Checks?branchName=master)](https://dev.azure.com/maluuba/0xDeCA10B/_build/latest?definitionId=118&branchName=master) |

**Decentralized & Collaborative AI on Blockchain** is a framework to host and train publicly available machine learning models.
Ideally, using a model to get a prediction is free.
Adding data consists of validation by three steps as described below.

<img src="./assets/architecture_flow.png?raw=true" width=500 alt="Picture of a someone sending data to the addData method in CollaborativeTrainer which sends data to the 3 main components as further described next.">

1. The **IncentiveMechanism** validates the transaction, for instance, in some cases a "stake" or deposit is required.
2. The **DataHandler** stores data and meta-data on the blockchain. This ensures that it is accessible for all future uses, not limited to this smart contract.
3. The machine learning **model** is updated according to predefined training algorithms. In addition to adding data, anyone can query the model for predictions, and the incentive mechanism may be triggered to provide users with payments or virtual "karma" points.

More details can be found in the initial paper describing the framework: [Decentralized & Collaborative AI on Blockchain Platforms][overview-paper], [dark theme version here][overview-paper-dark].

This repository contains:
* [Demos][demo-folder] showcasing some proof of concept systems using the Ethereum blockchain. There is a locally deployable test blockchain and demo dashboard to interact with smart contracts written in Solidity.
* [Simulation tools][simulation-folder] written in Python to quickly see how models and incentive mechanisms would work when deployed.

[demo-folder]: demo/
[simulation-folder]: simulation/
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
