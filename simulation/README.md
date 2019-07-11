# Decentralized & Collaborative AI Simulation

[![Build Status](https://dev.azure.com/maluuba/0xDeCA10B/_apis/build/status/simulation-CI?branchName=master)](https://dev.azure.com/maluuba/0xDeCA10B/_build/latest?definitionId=117&branchName=master)

Tools to run simulations for AI models in smart contracts.

## Examples

Even when a bad actor submits incorrect data, an honest contributor profits while the model's accuracy remains stable.

<img src="./assets/drt.gif?raw=true" width=500 alt="Graph showing a good agent's balance increasing and a bad agent's balance decreasing while the model's accuracy on a hidden test remains stable around 70%.">

In the above example, a Perceptron was trained on the [IMDB reviews dataset for sentiment classification][keras-imdb].

Here's a more detailed example:

<img src="./assets/1558466743_plot.png?raw=true" width=500 alt="Graph showing a good agent's balance increasing and a bad agent's balance decreasing while the model's accuracy on a hidden test remains stable around 79%.">

For this simulation, again a Perceptron was trained on the [IMDB reviews dataset for sentiment classification][keras-imdb].
The model was initially trained on 2000 of the 25000 training data samples.
The model has 1000 binary features which are the presence of the 1000 most frequent words in the dataset.
The graph below shows the results of a simulation where for simplicity, we show just one honest contributor and one malicious contributor but these contributors effectively represent many contributors submitting the remaining 92% of the training data over time.
In this simulation, we use the Deposit, Refund, and Take (DRT) incentive mechanism where contributors have 1 day to claim a refund.
Any contributor can take the remaining deposit from a contribution after 9 days.
"Bad Agent" is willing to spend about twice as much on deposits than an honest contributor, "Good Agent".
The adversary is only submitting data about one sixth as often.
Despite the malicious efforts, the accuracy can still be maintained and the honest contributors profit.

# Setup
This section explains how to set up locally, alternatively, you can skip ahead and use a Docker image.
Run:
```bash
conda create --channel conda-forge --name decai-simulation python=3.7 bokeh ipython mkl mkl-service numpy phantomjs scikit-learn scipy six tensorflow
conda activate decai-simulation
pip install -e .
```

## Docker Setup
You can use a Docker image by running:
```bash
docker run --rm -it -p 5006:5006 -v ${PWD}:/root/workspace/0xDeCA10B/simulation --name decai-simulation mcr.microsoft.com/samples/blockchain-ai/0xdeca10b-simulation bash
```

### Building the Docker Image
If you want to build your own fresh image:
```bash
docker build -t decai-simulation .
```

# Running Simulations
Run:
```bash
bokeh serve decai/simulation/simulate_imdb_perceptron.py
``` 

Then open the browser to the address the above command tells you.
It should be something like: [http://localhost:5006/simulate_imdb_perceptron](http://localhost:5006/simulate_imdb_perceptron).

# Customizing Simulations
To try out your own models or incentive mechanisms, you'll need to implement the interfaces.
You can proceed by just copying the examples. Here are the details if you need them:

Suppose you want to use a neural network for the classifier:
1. Implement the [`Classifier`](decai/simulation/contract/classification/classifier.py) interface in a class `NeuralNetworkClassifier`.
The easiest way is to copy an existing classifier like the [`Perceptron`](decai/simulation/contract/classification/perceptron.py).
2. Create a `Module` called `NeuralNetworkModule` which binds `Classifier` to your new class just like in [`PerceptronModule`](decai/simulation/contract/classification/perceptron.py).

Setting up a custom incentive mechanism is similar:
1. Implement [`IncentiveMechanism`](decai/simulation/contract/incentive/incentive_mechanism.py).
You can use [`Stakeable`](decai/simulation/contract/incentive/stakeable.py) as an example.
2. Bind your implementation in a module.

Now set up the main entry point to run the simulation: copy ([`decai/simulation/simulate_imdb_perceptron.py`](decai/simulation/simulate_imdb_perceptron.py)) to a new file, e.g. `decai/simulation/simulate_imdb_neural_network.py`.

In `simulate_imdb_neural_network.py`, you can set up the agents that will act in the simulation.
Then set the modules you created.
So instead of `PerceptronModule` put `NeuralNetworkModule`.

Run `bokeh serve decai/simulation/simulate_imdb_neural_network.py` and open your browse to the displayed URL to try it out.

# Testing
Setup the testing environment: 
```bash
pip install pytest
```

Run tests:
```bash
pytest
```

[keras-imdb]: https://keras.io/datasets/#imdb-movie-reviews-sentiment-classification
