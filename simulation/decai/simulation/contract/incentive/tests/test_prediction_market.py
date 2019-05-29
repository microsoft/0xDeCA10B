import unittest
from typing import cast

from injector import Injector

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.classification.perceptron import PerceptronModule
from decai.simulation.contract.collab_trainer import CollaborativeTrainer, DefaultCollaborativeTrainerModule
from decai.simulation.contract.incentive.incentive_mechanism import IncentiveMechanism
from decai.simulation.contract.incentive.prediction_market import PredictionMarketImModule, PredictionMarket
from decai.simulation.contract.objects import TimeMock
from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.tests.test_data_loader import TestDataModule
from decai.simulation.logging_module import LoggingModule


class TestPredictionMarket(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        inj = Injector([
            DefaultCollaborativeTrainerModule,
            TestDataModule,
            LoggingModule,
            PerceptronModule,
            PredictionMarketImModule,
        ])
        cls.balances = inj.get(Balances)
        cls.data = inj.get(DataLoader)
        cls.decai = inj.get(CollaborativeTrainer)
        cls.time_method = inj.get(TimeMock)
        cls.im = cast(PredictionMarket, inj.get(IncentiveMechanism))
        assert isinstance(cls.im, PredictionMarket)

    def test_market(self):
        init_train_data_portion = 0.25
        test_amount = 100

        initializer_address = 'initializer'
        total_bounty = 100_000
        self.balances.initialize(initializer_address, total_bounty)
        self.balances.send(initializer_address, self.im.address, total_bounty)

        good_contributor_address = 'good_contributor'
        self.balances.initialize(good_contributor_address, 10_000)

        bad_contributor_address = 'bad_contributor'
        self.balances.initialize(bad_contributor_address, 10_000)

        (x_train, y_train), (x_test, y_test) = self.data.load_data()
        x_test = x_test[:test_amount]
        y_test = y_test[:test_amount]

        init_idx = int(len(x_train) * init_train_data_portion)
        assert init_idx > 0

        x_init_data, y_init_data = x_train[:init_idx], y_train[:init_idx]
        x_remaining, y_remaining = x_train[init_idx:], y_train[init_idx:]

        # Split test set into pieces.
        num_pieces = 10
        test_sets = []
        test_dataset_hashes = []
        for i in range(num_pieces):
            start = int(i / num_pieces * len(x_test))
            end = int((i + 1) / num_pieces * len(x_test))
            test_set = list(zip(x_test[start:end], y_test[start:end]))
            test_sets.append(test_set)
            test_dataset_hashes.append(self.im.hash_test_set(test_set))

        # Ending criteria:
        min_length_s = 100
        min_num_contributions = min(len(x_remaining), 100)

        # Initially deployed model.
        self.im.model.init_model(x_init_data, y_init_data)

        # Commitment Phase
        test_reveal_index = self.im.initialize_market(initializer_address, total_bounty, test_dataset_hashes,
                                                      min_length_s, min_num_contributions)
        assert 0 <= test_reveal_index < len(test_dataset_hashes)
        self.im.reveal_init_test_set(test_sets[test_reveal_index])

        # Participation Phase
        value = 100
        for i in range(min_num_contributions):
            data = x_remaining[i]
            classification = y_remaining[i]
            if i % 2 == 0:
                contributor = good_contributor_address
            else:
                contributor = bad_contributor_address
                classification = 1 - classification
            cost = self.im.handle_add_data(contributor, value, data, classification)
            self.balances.send(contributor, self.im.address, cost)

        # Reward Phase
        self.im.end_market(initializer_address, test_sets)

        assert self.balances[good_contributor_address] > self.balances[bad_contributor_address]

        # TODO Test more.
