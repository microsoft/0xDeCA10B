import random
import unittest
from collections import defaultdict
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

        initializer_address = 'initializer'
        total_bounty = 100_000
        self.balances.initialize(initializer_address, total_bounty)

        good_contributor_address = 'good_contributor'
        initial_good_balance = 10_000
        self.balances.initialize(good_contributor_address, initial_good_balance)

        bad_contributor_address = 'bad_contributor'
        initial_bad_balance = 10_000
        self.balances.initialize(bad_contributor_address, initial_bad_balance)

        (x_train, y_train), (x_test, y_test) = self.data.load_data()

        init_idx = int(len(x_train) * init_train_data_portion)
        assert init_idx > 0

        x_init_data, y_init_data = x_train[:init_idx], y_train[:init_idx]
        x_remaining, y_remaining = x_train[init_idx:], y_train[init_idx:]

        # Split test set into pieces.
        num_pieces = 10
        test_dataset_hashes, test_sets = self.im.get_test_set_hashes(num_pieces, x_test, y_test)

        # Ending criteria:
        min_length_s = 100
        min_num_contributions = min(len(x_remaining), 100)

        # Commitment Phase
        # Seed randomness for consistency.
        random.seed(0xDeCA10B)
        test_reveal_index = self.im.initialize_market(initializer_address, total_bounty,
                                                      x_init_data, y_init_data,
                                                      test_dataset_hashes,
                                                      min_length_s, min_num_contributions)
        assert 0 <= test_reveal_index < len(test_dataset_hashes)
        # For consistency.
        assert test_reveal_index == 4
        self.im.reveal_init_test_set(test_sets[test_reveal_index])

        # Participation Phase
        value = 100
        total_deposits = defaultdict(float)
        for i in range(min_num_contributions):
            data = x_remaining[i]
            classification = y_remaining[i]
            if i % 2 == 0:
                contributor = good_contributor_address
            else:
                contributor = bad_contributor_address
                classification = 1 - classification
            cost = self.im.handle_add_data(contributor, value, data, classification)
            self.balances.send(contributor, self.im.owner, cost)
            total_deposits[contributor] += cost

        # Reward Phase
        self.im.end_market(initializer_address, test_sets)
        while self.im.remaining_bounty_rounds > 0:
            self.im.process_contribution()

        # Collect rewards.
        for contributor in [good_contributor_address, bad_contributor_address]:
            # Don't need to pass the right StoredData.
            # noinspection PyTypeChecker
            reward = self.im.handle_refund(contributor, None, 0, False, None)
            self.balances.send(self.im.owner, contributor, reward)

        # General checks that should be true for a market with a reasonably sensitive model.
        self.assertLess(self.balances[self.im.owner], total_bounty,
                        f"Some of the bounty should be distributed.\n"
                        f"Balances: {self.balances.get_all()}")
        self.assertLess(0, self.balances[self.im.owner])

        self.assertLess(self.balances[bad_contributor_address], initial_bad_balance)
        self.assertGreater(self.balances[good_contributor_address], initial_good_balance)
        self.assertLess(self.balances[bad_contributor_address], self.balances[good_contributor_address])
        self.assertLessEqual(self.balances[good_contributor_address] - self.balances[bad_contributor_address],
                             total_bounty)
        self.assertEqual(initial_good_balance + initial_bad_balance + total_bounty,
                         self.balances[good_contributor_address] + self.balances[bad_contributor_address] +
                         self.balances[self.im.owner],
                         "Should be a zero-sum.")

        self.assertEqual(initial_bad_balance - total_deposits[bad_contributor_address],
                         self.balances[bad_contributor_address],
                         "The bad contributor should lose all of their deposits.")

        # Specific checks for the randomness seed set.
        self.assertEqual(9994, self.balances[bad_contributor_address])
        self.assertEqual(49997, self.balances[good_contributor_address])
        self.assertEqual(60009, self.balances[self.im.owner])
