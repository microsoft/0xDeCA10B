import os
import sys

from injector import inject, Injector

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.classification.perceptron import PerceptronModule
from decai.simulation.contract.collab_trainer import DefaultCollaborativeTrainerModule
from decai.simulation.contract.incentive.incentive_mechanism import IncentiveMechanism
from decai.simulation.contract.incentive.prediction_market import PredictionMarket, PredictionMarketImModule
from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.imdb_data_loader import ImdbDataModule
from decai.simulation.logging_module import LoggingModule
from decai.simulation.simulate import Agent, Simulator

# For `bokeh serve`.
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))


class Runner(object):
    @inject
    def __init__(self,
                 balances: Balances,
                 data: DataLoader,
                 im: IncentiveMechanism,
                 simulator: Simulator,
                 ):
        assert isinstance(im, PredictionMarket)

        self._balances = balances
        self._data = data
        self._im = im
        self._s = simulator

    def run(self):
        initializer_address = 'initializer'
        total_bounty = 1_000_000
        init_train_data_portion = 0.08

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
        ]

        self._balances.initialize(initializer_address, total_bounty)

        (x_train, y_train), (x_test, y_test) = self._data.load_data()
        init_idx = int(len(x_train) * init_train_data_portion)
        assert init_idx > 0
        x_init_data, y_init_data = x_train[:init_idx], y_train[:init_idx]
        x_remaining, y_remaining = x_train[init_idx:], y_train[init_idx:]

        # Split test set into pieces.
        num_pieces = 10
        test_dataset_hashes, test_sets = self._im.get_test_set_hashes(num_pieces, x_test, y_test)

        # Ending criteria:
        min_length_s = 1_000_000
        min_num_contributions = len(x_remaining)

        test_reveal_index = self._im.initialize_market(initializer_address, total_bounty,
                                                       x_init_data, y_init_data,
                                                       test_dataset_hashes,
                                                       min_length_s, min_num_contributions)
        assert 0 <= test_reveal_index < len(test_dataset_hashes)
        self._im.reveal_init_test_set(test_sets[test_reveal_index])

        # Start the simulation.
        self._s.simulate(agents,
                         # Accuracy on hidden test set after training with all training data:
                         # With num_words = 100:
                         # baseline_accuracy=0.6210,
                         # With num_words = 200:
                         # baseline_accuracy=0.6173,
                         # With num_words = 1000:
                         baseline_accuracy=0.7945,
                         # With num_words = 10000:
                         # baseline_accuracy=0.84692,
                         # With num_words = 20000:
                         # baseline_accuracy=0.8484,

                         init_train_data_portion=init_train_data_portion,

                         initializer_address=initializer_address,
                         test_sets=test_sets
                         )


# Run with `bokeh serve PATH`.
if __name__.startswith('bk_script_'):
    # Set up the data, model, and incentive mechanism.
    inj = Injector([
        DefaultCollaborativeTrainerModule,
        ImdbDataModule,
        LoggingModule,
        PerceptronModule,
        PredictionMarketImModule,
    ])
    inj.get(Runner).run()
