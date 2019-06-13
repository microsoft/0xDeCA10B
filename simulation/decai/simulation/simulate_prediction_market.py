import os
import sys

import math
from injector import inject, Injector

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.classification.perceptron import PerceptronModule
from decai.simulation.contract.collab_trainer import DefaultCollaborativeTrainerModule
from decai.simulation.contract.incentive.incentive_mechanism import IncentiveMechanism
from decai.simulation.contract.incentive.prediction_market import PredictionMarket, PredictionMarketImModule
from decai.simulation.contract.objects import Msg
from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.imdb_data_loader import ImdbDataModule
from decai.simulation.logging_module import LoggingModule
from decai.simulation.simulate import Agent, Simulator

# For `bokeh serve`.
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

num_words = 1000


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
        total_bounty = 100_000
        train_size = 10_000
        test_size = 1000
        init_train_data_portion = 10 / train_size

        # Set up the agents that will act in the simulation.
        agents = [
            # Good
            Agent(address="Good 1",
                  start_balance=10_000,
                  mean_deposit=5,
                  stdev_deposit=1,
                  mean_update_wait_s=10 * 60,
                  ),
            Agent(address="Good 2",
                  start_balance=10_000,
                  mean_deposit=5,
                  stdev_deposit=1,
                  mean_update_wait_s=20 * 60,
                  ),
            Agent(address="Good 3",
                  start_balance=10_000,
                  mean_deposit=5,
                  stdev_deposit=1,
                  mean_update_wait_s=30 * 60,
                  ),
            # Malicious: determined  with the goal of disrupting others.
            Agent(address="Bad 1",
                  start_balance=10_000,
                  mean_deposit=10,
                  stdev_deposit=3,
                  mean_update_wait_s=1 * 60 * 60,
                  good=False,
                  ),
            Agent(address="Bad 2",
                  start_balance=10_000,
                  mean_deposit=10,
                  stdev_deposit=3,
                  mean_update_wait_s=1 * 60 * 60,
                  good=False,
                  ),
        ]

        self._balances.initialize(initializer_address, total_bounty)

        (x_train, y_train), (x_test, y_test) = self._data.load_data(train_size=train_size, test_size=test_size)
        init_idx = int(len(x_train) * init_train_data_portion)
        assert init_idx > 0
        x_init_data, y_init_data = x_train[:init_idx], y_train[:init_idx]
        x_remaining, y_remaining = x_train[init_idx:], y_train[init_idx:]

        # Split test set into pieces.
        num_pieces = 10
        test_dataset_hashes, test_sets = self._im.get_test_set_hashes(num_pieces, x_test, y_test)

        # Ending criteria:
        min_length_s = 1_000
        min_num_contributions = len(x_remaining)

        self._im.model.init_model(x_init_data, y_init_data)
        test_reveal_index = self._im.initialize_market(Msg(initializer_address, total_bounty),
                                                       test_dataset_hashes,
                                                       min_length_s, min_num_contributions)
        assert 0 <= test_reveal_index < len(test_dataset_hashes)
        self._im.reveal_init_test_set(test_sets[test_reveal_index])

        # Accuracy on hidden test set after training with all training data:
        baseline_accuracies = {
            100: 0.6210,
            200: 0.6173,
            1000: 0.7945,
            10000: 0.84692,
            20000: 0.8484,
        }

        # Start the simulation.
        self._s.simulate(agents,
                         baseline_accuracy=baseline_accuracies[num_words],
                         init_train_data_portion=init_train_data_portion,
                         pm_test_sets=test_sets,
                         accuracy_plot_wait_s=math.inf,
                         train_size=train_size,
                         )


# Run with `bokeh serve PATH`.
if __name__.startswith('bk_script_'):
    # Set up the data, model, and incentive mechanism.
    inj = Injector([
        DefaultCollaborativeTrainerModule,
        ImdbDataModule(num_words=num_words),
        LoggingModule,
        PerceptronModule,
        PredictionMarketImModule,
    ])
    inj.get(Runner).run()
