import os
import sys

from injector import Injector

from decai.simulation.contract.classification.perceptron import PerceptronModule
from decai.simulation.contract.collab_trainer import DefaultCollaborativeTrainerModule
from decai.simulation.contract.incentive.stakeable import StakeableImModule
from decai.simulation.data.imdb_data_loader import ImdbDataModule
from decai.simulation.logging_module import LoggingModule
from decai.simulation.simulate import Agent, Simulator

# For `bokeh serve`.
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

num_words = 1000
train_size = None
if train_size is None:
    init_train_data_portion = 0.08
else:
    init_train_data_portion = 100 / train_size


def main():
    # Set up the agents that will act in the simulation.
    agents = [
        # Good
        Agent(address="Good",
              start_balance=10_000,
              mean_deposit=50,
              stdev_deposit=10,
              mean_update_wait_s=10 * 60,
              prob_mistake=0.0001,
              ),
        # Malicious: A determined agent with the goal of disrupting others.
        Agent(address="Bad",
              start_balance=10_000,
              mean_deposit=100,
              stdev_deposit=3,
              mean_update_wait_s=1 * 60 * 60,
              good=False,
              ),
        # One that just calls the model and pays to use the model.
        Agent(address="Caller",
              start_balance=30_000,
              mean_deposit=0,
              stdev_deposit=0,
              mean_update_wait_s=2 * 60 * 60,
              calls_model=True,
              pay_to_call=50
              ),
    ]
    # No caller (assume free to call).
    agents = agents[:-1]

    # Set up the data, model, and incentive mechanism.
    inj = Injector([
        DefaultCollaborativeTrainerModule,
        ImdbDataModule(num_words=num_words),
        LoggingModule,
        PerceptronModule,
        StakeableImModule,
    ])
    s = inj.get(Simulator)

    # Accuracy on hidden test set after training with all training data:
    baseline_accuracies = {
        100: 0.6210,
        200: 0.6173,
        1000: 0.7945,
        10000: 0.84692,
        20000: 0.8484,
    }

    # Start the simulation.
    s.simulate(agents,
               baseline_accuracy=baseline_accuracies[num_words],
               init_train_data_portion=0.08,
               train_size=train_size,
               )


# Run with `bokeh serve PATH`.
if __name__.startswith('bk_script_'):
    main()
