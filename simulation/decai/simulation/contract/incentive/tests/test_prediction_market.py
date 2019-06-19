import unittest
from collections import defaultdict
from typing import cast

from injector import Injector

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.classification.perceptron import PerceptronModule
from decai.simulation.contract.data.data_handler import StoredData
from decai.simulation.contract.incentive.incentive_mechanism import IncentiveMechanism
from decai.simulation.contract.incentive.prediction_market import MarketPhase, \
    PredictionMarket, PredictionMarketImModule
from decai.simulation.contract.objects import Msg, TimeMock
from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.simple_data_loader import SimpleDataModule
from decai.simulation.logging_module import LoggingModule


class TestPredictionMarket(unittest.TestCase):
    def test_market_like_original_paper(self):
        inj = Injector([
            SimpleDataModule,
            LoggingModule,
            PerceptronModule,
            PredictionMarketImModule(
                allow_greater_deposit=False,
                group_contributions=False,
                reset_model_during_reward_phase=False,
            ),
        ])

        balances = inj.get(Balances)
        data = inj.get(DataLoader)
        im = cast(PredictionMarket, inj.get(IncentiveMechanism))
        im.owner = 'owner'
        assert isinstance(im, PredictionMarket)

        init_train_data_portion = 0.2

        initializer_address = 'initializer'
        total_bounty = 100_000
        balances.initialize(initializer_address, total_bounty)

        good_contributor_address = 'good_contributor'
        initial_good_balance = 10_000
        balances.initialize(good_contributor_address, initial_good_balance)

        bad_contributor_address = 'bad_contributor'
        initial_bad_balance = 10_000
        balances.initialize(bad_contributor_address, initial_bad_balance)

        (x_train, y_train), (x_test, y_test) = data.load_data()

        init_idx = int(len(x_train) * init_train_data_portion)
        assert init_idx > 0

        x_init_data, y_init_data = x_train[:init_idx], y_train[:init_idx]
        x_remaining, y_remaining = x_train[init_idx:], y_train[init_idx:]

        # Split test set into pieces.
        num_pieces = 10
        test_dataset_hashes, test_sets = im.get_test_set_hashes(num_pieces, x_test, y_test)

        # Ending criteria:
        min_length_s = 100
        min_num_contributions = min(len(x_remaining), 100)

        # Commitment Phase
        self.assertIsNone(im.state)

        im.model.init_model(x_init_data, y_init_data)

        hashes_split = 3
        test_reveal_index = im.initialize_market(Msg(initializer_address, total_bounty),
                                                 test_dataset_hashes[:hashes_split],
                                                 min_length_s, min_num_contributions)
        assert 0 <= test_reveal_index < len(test_dataset_hashes)
        self.assertEqual(MarketPhase.INITIALIZATION, im.state)

        test_reveal_index = im.add_test_set_hashes(Msg(initializer_address, 0), test_dataset_hashes[hashes_split:])
        assert 0 <= test_reveal_index < len(test_dataset_hashes)
        self.assertEqual(MarketPhase.INITIALIZATION, im.state)

        im.reveal_init_test_set(test_sets[test_reveal_index])

        self.assertEqual(MarketPhase.PARTICIPATION, im.state)
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
            cost, _ = im.handle_add_data(contributor, value, data, classification)
            self.assertEqual(im.min_stake, cost, "Cost should be the minimum stake because of the options passed in.")
            balances.send(contributor, im.owner, cost)
            total_deposits[contributor] += cost

        # Reward Phase
        self.assertEqual(MarketPhase.PARTICIPATION, im.state)
        im.end_market()
        self.assertEqual(MarketPhase.REVEAL_TEST_SET, im.state)
        for i, test_set_portion in enumerate(test_sets):
            if i != test_reveal_index:
                im.verify_next_test_set(test_set_portion)
        self.assertEqual(MarketPhase.REWARD_RESTART, im.state)
        while im.remaining_bounty_rounds > 0:
            im.process_contribution()

        # Collect rewards.
        self.assertEqual(MarketPhase.REWARD_COLLECT, im.state)
        for contributor in [good_contributor_address, bad_contributor_address]:
            # Don't need to pass the right StoredData.
            # noinspection PyTypeChecker
            reward = im.handle_refund(contributor, None, 0, False, None)
            balances.send(im.owner, contributor, reward)

        self.assertGreater(total_deposits[good_contributor_address], 0)
        self.assertGreater(total_deposits[bad_contributor_address], 0)

        # General checks that should be true for a market with a reasonably sensitive model.
        self.assertLess(balances[im.owner], total_bounty,
                        f"Some of the bounty should be distributed.\n"
                        f"Balances: {balances.get_all()}")
        self.assertLess(0, balances[im.owner])

        # Sometimes the bad contributor happens to get some value but not much.
        self.assertAlmostEqual(balances[bad_contributor_address], initial_bad_balance, delta=1,
                                msg=f"The bad contributor should lose funds.\n"
                                f"Balances: {balances.get_all()}")
        self.assertGreater(balances[good_contributor_address], initial_good_balance)
        self.assertLess(balances[bad_contributor_address], balances[good_contributor_address])
        self.assertLessEqual(balances[good_contributor_address] - balances[bad_contributor_address],
                             total_bounty)
        self.assertEqual(initial_good_balance + initial_bad_balance + total_bounty,
                         balances[good_contributor_address] + balances[bad_contributor_address] +
                         balances[im.owner],
                         "Should be a zero-sum.")

    def test_market(self):
        inj = Injector([
            SimpleDataModule,
            LoggingModule,
            PerceptronModule,
            PredictionMarketImModule(
                allow_greater_deposit=True,
                group_contributions=True,
                reset_model_during_reward_phase=True,
            ),
        ])
        balances = inj.get(Balances)
        data = inj.get(DataLoader)
        im = cast(PredictionMarket, inj.get(IncentiveMechanism))
        im.owner = 'owner'

        assert isinstance(im, PredictionMarket)

        init_train_data_portion = 0.2

        initializer_address = 'initializer'
        total_bounty = 100_000
        balances.initialize(initializer_address, total_bounty)

        good_contributor_address = 'good_contributor'
        initial_good_balance = 10_000
        balances.initialize(good_contributor_address, initial_good_balance)

        bad_contributor_address = 'bad_contributor'
        initial_bad_balance = 10_000
        balances.initialize(bad_contributor_address, initial_bad_balance)

        (x_train, y_train), (x_test, y_test) = data.load_data()

        init_idx = int(len(x_train) * init_train_data_portion)
        assert init_idx > 0

        x_init_data, y_init_data = x_train[:init_idx], y_train[:init_idx]
        x_remaining, y_remaining = x_train[init_idx:], y_train[init_idx:]

        # Split test set into pieces.
        num_pieces = 10
        test_dataset_hashes, test_sets = im.get_test_set_hashes(num_pieces, x_test, y_test)

        # Ending criteria:
        min_length_s = 100
        min_num_contributions = min(len(x_remaining), 100)

        # Commitment Phase
        self.assertIsNone(im.state)

        im.model.init_model(x_init_data, y_init_data)

        hashes_split = 3
        test_reveal_index = im.initialize_market(Msg(initializer_address, total_bounty),
                                                 test_dataset_hashes[:hashes_split],
                                                 min_length_s, min_num_contributions)
        assert 0 <= test_reveal_index < len(test_dataset_hashes)
        self.assertEqual(MarketPhase.INITIALIZATION, im.state)

        test_reveal_index = im.add_test_set_hashes(Msg(initializer_address, 0), test_dataset_hashes[hashes_split:])
        assert 0 <= test_reveal_index < len(test_dataset_hashes)
        self.assertEqual(MarketPhase.INITIALIZATION, im.state)

        im.reveal_init_test_set(test_sets[test_reveal_index])

        self.assertEqual(MarketPhase.PARTICIPATION, im.state)
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
            cost, _ = im.handle_add_data(contributor, value, data, classification)
            balances.send(contributor, im.owner, cost)
            total_deposits[contributor] += cost

        # Reward Phase
        self.assertEqual(MarketPhase.PARTICIPATION, im.state)
        im.end_market()
        self.assertEqual(MarketPhase.REVEAL_TEST_SET, im.state)
        for i, test_set_portion in enumerate(test_sets):
            if i != test_reveal_index:
                im.verify_next_test_set(test_set_portion)
        self.assertEqual(MarketPhase.REWARD_RESTART, im.state)
        while im.remaining_bounty_rounds > 0:
            im.process_contribution()

        # Collect rewards.
        self.assertEqual(MarketPhase.REWARD_COLLECT, im.state)
        for contributor in [good_contributor_address, bad_contributor_address]:
            # Don't need to pass the right StoredData.
            # noinspection PyTypeChecker
            reward = im.handle_refund(contributor, None, 0, False, None)
            balances.send(im.owner, contributor, reward)

        self.assertGreater(total_deposits[good_contributor_address], 0)
        self.assertGreater(total_deposits[bad_contributor_address], 0)

        # General checks that should be true for a market with a reasonably sensitive model.
        self.assertLess(balances[im.owner], total_bounty,
                        f"Some of the bounty should be distributed.\n"
                        f"Balances: {balances.get_all()}")
        self.assertLess(0, balances[im.owner])

        self.assertLess(balances[bad_contributor_address], initial_bad_balance)
        self.assertGreater(balances[good_contributor_address], initial_good_balance)
        self.assertLess(balances[bad_contributor_address], balances[good_contributor_address])
        self.assertLessEqual(balances[good_contributor_address] - balances[bad_contributor_address],
                             total_bounty)
        self.assertEqual(initial_good_balance + initial_bad_balance + total_bounty,
                         balances[good_contributor_address] + balances[bad_contributor_address] +
                         balances[im.owner],
                         "Should be a zero-sum.")

        self.assertEqual(initial_bad_balance - total_deposits[bad_contributor_address],
                         balances[bad_contributor_address],
                         "The bad contributor should lose all of their deposits.")

    def test_report(self):
        inj = Injector([
            SimpleDataModule,
            LoggingModule,
            PerceptronModule,
            PredictionMarketImModule(
                allow_greater_deposit=True,
                group_contributions=True,
                reset_model_during_reward_phase=True,
            ),
        ])
        balances = inj.get(Balances)
        data = inj.get(DataLoader)
        im = cast(PredictionMarket, inj.get(IncentiveMechanism))
        im.owner = 'owner'
        time_method = inj.get(TimeMock)

        assert isinstance(im, PredictionMarket)

        init_train_data_portion = 0.2

        initializer_address = 'initializer'
        total_bounty = 100_000
        balances.initialize(initializer_address, total_bounty)

        good_contributor_address = 'good_contributor'
        initial_good_balance = 10_000
        balances.initialize(good_contributor_address, initial_good_balance)

        bad_contributor_address = 'bad_contributor'
        initial_bad_balance = 10_000
        balances.initialize(bad_contributor_address, initial_bad_balance)

        (x_train, y_train), (x_test, y_test) = data.load_data()

        init_idx = int(len(x_train) * init_train_data_portion)
        assert init_idx > 0

        x_init_data, y_init_data = x_train[:init_idx], y_train[:init_idx]
        x_remaining, y_remaining = x_train[init_idx:], y_train[init_idx:]

        # Split test set into pieces.
        num_pieces = 10
        test_dataset_hashes, test_sets = im.get_test_set_hashes(num_pieces, x_test, y_test)

        # Ending criteria:
        min_length_s = 100
        min_num_contributions = min(len(x_remaining), 100)

        # Commitment Phase
        self.assertIsNone(im.state)
        im.model.init_model(x_init_data, y_init_data)
        test_reveal_index = im.initialize_market(Msg(initializer_address, total_bounty),
                                                 test_dataset_hashes,
                                                 min_length_s, min_num_contributions)
        self.assertEqual(MarketPhase.INITIALIZATION, im.state)
        assert 0 <= test_reveal_index < len(test_dataset_hashes)
        im.reveal_init_test_set(test_sets[test_reveal_index])

        self.assertEqual(MarketPhase.PARTICIPATION, im.state)
        # Participation Phase
        value = 100
        total_deposits = defaultdict(float)
        stored_data = None
        for i in range(min_num_contributions):
            time_method.add_time(60)
            data = x_remaining[i]
            classification = y_remaining[i]
            if i % 2 == 0:
                contributor = good_contributor_address
            else:
                contributor = bad_contributor_address
                classification = 1 - classification
            cost, _ = im.handle_add_data(contributor, value, data, classification)
            if stored_data is None:
                stored_data = StoredData(classification, time_method(), contributor, cost, cost)
            balances.send(contributor, im.owner, cost)
            total_deposits[contributor] += cost

        # Reward Phase
        self.assertEqual(MarketPhase.PARTICIPATION, im.state)
        im.end_market()
        time_method.add_time(60)
        self.assertEqual(MarketPhase.REVEAL_TEST_SET, im.state)
        for i, test_set_portion in enumerate(test_sets):
            if i != test_reveal_index:
                im.verify_next_test_set(test_set_portion)
        self.assertEqual(MarketPhase.REWARD_RESTART, im.state)
        while im.remaining_bounty_rounds > 0:
            time_method.add_time(60)
            im.process_contribution()

        # Collect rewards.
        self.assertEqual(MarketPhase.REWARD_COLLECT, im.state)

        # Get some stored data.

        # Make sure reporting doesn't work yet.
        reward = im.handle_report(bad_contributor_address, stored_data, False, None)
        self.assertEqual(0, reward, "There should be no reward yet.")

        time_method.add_time(im.any_address_claim_wait_time_s)
        reward = im.handle_report(bad_contributor_address, stored_data, False, None)
        balances.send(im.owner, bad_contributor_address, reward)

        # Don't need to pass the right StoredData.
        # noinspection PyTypeChecker
        reward = im.handle_refund(bad_contributor_address, None, 0, False, None)
        balances.send(im.owner, bad_contributor_address, reward)

        # General checks that should be true for a market with a reasonably sensitive model.
        self.assertLess(balances[im.owner], total_bounty,
                        f"Some of the bounty should be distributed.\n"
                        f"Balances: {balances.get_all()}")
        self.assertLess(0, balances[im.owner])

        self.assertGreater(total_deposits[good_contributor_address], 0)
        self.assertGreater(total_deposits[bad_contributor_address], 0)

        # The bad contributor profited because they reported the good contributor.
        self.assertGreater(balances[bad_contributor_address], initial_bad_balance)
        self.assertLess(balances[good_contributor_address], initial_good_balance)

        self.assertLess(balances[good_contributor_address], balances[bad_contributor_address])
        self.assertLessEqual(balances[bad_contributor_address] - balances[good_contributor_address],
                             total_bounty)
        self.assertEqual(initial_good_balance + initial_bad_balance + total_bounty,
                         balances[good_contributor_address] + balances[bad_contributor_address] +
                         balances[im.owner],
                         "Should be a zero-sum.")

        self.assertEqual(initial_good_balance - total_deposits[good_contributor_address],
                         balances[good_contributor_address],
                         "The good contributor should lose all of their deposits.")
