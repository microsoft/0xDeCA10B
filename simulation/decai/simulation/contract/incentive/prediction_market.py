import random
from collections import defaultdict
from dataclasses import dataclass
from enum import Enum
from hashlib import sha256
from logging import Logger
from typing import Dict, Union

import math
import numpy as np
from injector import inject, Module, singleton

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.data.data_handler import StoredData
from decai.simulation.contract.incentive.incentive_mechanism import IncentiveMechanism
from decai.simulation.contract.objects import Address, RejectException, TimeMock


class MarketState(Enum):
    INITIALIZATION = 0
    PARTICIPATION = 1
    REWARD = 2
    REWARD_RE_INITIALIZE_MODEL = 3


@dataclass
class _Contribution:
    contributor_address: Address
    deposit: Union[int, float]
    data: np.array
    classification: int


@singleton
class PredictionMarket(IncentiveMechanism):
    @inject
    def __init__(self,
                 # Injected
                 balances: Balances,
                 logger: Logger,
                 model: Classifier,
                 time_method: TimeMock,
                 # Parameters
                 any_address_claim_wait_time_s=60 * 60 * 24 * 7.
                 ):
        super().__init__(any_address_claim_wait_time_s=any_address_claim_wait_time_s)

        self._balances = balances
        self._logger = logger
        self.model = model
        self._time = time_method

        self._market_start_time_s = None
        self._market_balances: Dict[Address, float] = defaultdict(float)
        """ Keeps track of balances in the market. """

        self._init_test_set_revealed = False
        self._next_data_index = None

        self.state = None

    def distribute_payment_for_prediction(self, sender, value):
        pass

    def end_market(self, msg_sender: Address, test_sets: list):
        # TODO Split into separate function calls
        # so that it's more like what would really happen in Ethereum to reduce gas costs.
        assert msg_sender == self.initializer_address
        assert self.state == MarketState.PARTICIPATION
        assert self._init_test_set_revealed, "The initial test set has not been revealed."
        if len(self._market_data) < self.min_num_contributions \
                and self._time() < self._market_start_time_s + self.min_length_s:
            raise RejectException("Can't end the market yet.")

        self._logger.info("Ending market.")
        self.state = MarketState.REWARD_RE_INITIALIZE_MODEL
        self._next_data_index = 0

        all_test_data = []
        for i, test_set in enumerate(test_sets):
            if i != self.test_reveal_index:
                self.verify_test_set(i, test_set)
                all_test_data += test_set

        self._test_data, self._test_labels = list(zip(*all_test_data))

        # Signal that no market is running.
        self._market_start_time_s = None

    def get_test_set_hashes(self, num_pieces, x_test, y_test):
        """
        Break the test set into `num_pieces` and returns their hashes.
        :param num_pieces: The number of pieces to break the test set into.
        :param x_test:
        :param y_test:
        :return:
        """
        test_sets = []
        test_dataset_hashes = []
        assert len(x_test) == len(y_test) >= num_pieces
        for i in range(num_pieces):
            start = int(i / num_pieces * len(x_test))
            end = int((i + 1) / num_pieces * len(x_test))
            test_set = list(zip(x_test[start:end], y_test[start:end]))
            test_sets.append(test_set)
            test_dataset_hashes.append(self.hash_test_set(test_set))
        return test_dataset_hashes, test_sets

    def handle_add_data(self, contributor_address: Address, msg_value: float, data, classification) -> (float, bool):
        assert self.state == MarketState.PARTICIPATION
        cost = self.min_stake
        update_model = False
        if cost > msg_value:
            raise RejectException(f"Did not pay enough. Sent {msg_value} < {cost}")
        self._market_data.append(_Contribution(contributor_address, cost, data, classification))
        self._market_balances[contributor_address] += cost
        return (cost, update_model)

    def handle_refund(self, submitter: Address, stored_data: StoredData,
                      claimable_amount: float, claimed_by_submitter: bool,
                      prediction) -> float:
        assert self.remaining_bounty_rounds == 0, "The reward phase has not finished processing contributions."
        result = self._market_balances[submitter]
        self._logger.debug("Reward for \"%s\": %s", submitter, result)
        if result > 0:
            del self._market_balances[submitter]
        else:
            result = 0
        return result

    def handle_report(self, reporter: Address, stored_data: StoredData, claimed_by_reporter: bool, prediction) -> float:
        assert self.remaining_bounty_rounds == 0, "The reward phase has not finished processing contributions."
        assert self.reward_phase_end_time_s > 0, "The reward phase has not finished processing contributions."
        if self._time() - self.reward_phase_end_time_s >= self.any_address_claim_wait_time_s:
            submitter = stored_data.sender
            result = self._market_balances[submitter]
            if result > 0:
                self._logger.debug("Giving reward for \"%s\" to \"%s\". Reward: %s", submitter, reporter, result)
                del self._market_balances[reporter]
        else:
            result = 0
        return result

    def hash_test_set(self, test_set):
        return sha256(str(test_set).encode()).hexdigest()

    def initialize_market(self, initializer_address: Address, total_bounty: int,
                          x_init_data, y_init_data,
                          test_dataset_hashes: list,
                          # Ending criteria:
                          min_length_s: int, min_num_contributions: int):
        assert self._market_start_time_s is None
        assert self._next_data_index is None, "The market end has already been triggered."
        self.initializer_address = initializer_address
        self.total_bounty = total_bounty
        self.remaining_bounty_rounds = self.total_bounty
        self._x_init_data = x_init_data
        self._y_init_data = y_init_data
        self.test_dataset_hashes = test_dataset_hashes
        self.test_reveal_index = random.randrange(len(self.test_dataset_hashes))
        self.min_stake = 1
        self.min_length_s = min_length_s
        self.min_num_contributions = min_num_contributions
        self.reward_phase_end_time_s = None

        self._market_data = []
        self._market_start_time_s = self._time()

        self._balances.send(initializer_address, self.owner, total_bounty)

        self._init_test_set_revealed = False
        self.state = MarketState.INITIALIZATION

        return self.test_reveal_index

    def process_contribution(self):
        assert self.remaining_bounty_rounds > 0, "The market has ended."

        if self.state == MarketState.REWARD_RE_INITIALIZE_MODEL:
            self._next_data_index = 0
            self._logger.debug("Remaining bounty rounds: %s", self.remaining_bounty_rounds)
            self._scores = defaultdict(float)
            # The paper implies that we should not retrain the model and instead only train once.
            # The problem there is that a contributor is affected by bad contributions
            # between them and the last counted contribution.
            # So this will be implemented with retraining for now,
            # though this might not be feasible with gas limits in Ethereum.
            self._logger.debug("Re-initializing model.", )
            self.model.init_model(self._x_init_data, self._y_init_data)

            self._prev_acc = self.model.evaluate(self._test_data, self._test_labels)
            self._logger.debug("Accuracy: %0.2f%%", self._prev_acc * 100)
            self._worst_contributor = None
            self._min_score = math.inf
            self.state = MarketState.REWARD
        else:
            assert self.state == MarketState.REWARD

        contribution = self._market_data[self._next_data_index]
        self.model.update(contribution.data, contribution.classification)
        self._next_data_index += 1
        need_restart = self._next_data_index >= len(self._market_data)
        if need_restart \
                or self._market_data[self._next_data_index].contributor_address != contribution.contributor_address:
            # Next contributor is different.
            acc = self.model.evaluate(self._test_data, self._test_labels)
            score_change = acc - self._prev_acc
            new_score = self._scores[contribution.contributor_address] + score_change
            self._scores[contribution.contributor_address] = new_score
            if (score_change < 0 and self._scores[contribution.contributor_address] < self._min_score) \
                    or self._worst_contributor == contribution.contributor_address:
                self._min_score = self._scores[contribution.contributor_address]
                self._worst_contributor = contribution.contributor_address

            self._prev_acc = acc
            if need_restart:
                # Find min score and remove that address from the list.
                self._logger.debug("Minimum score: \"%s\": %s", self._worst_contributor, self._min_score)
                if self._min_score < 0:
                    num_rounds = self._market_balances[self._worst_contributor] / -self._min_score
                    if num_rounds > self.remaining_bounty_rounds:
                        num_rounds = self.remaining_bounty_rounds
                    self.remaining_bounty_rounds -= num_rounds
                    for participant, score in self._scores.items():
                        self._market_balances[participant] += score * num_rounds
                    self._market_data = list(
                        filter(lambda c: c.contributor_address != self._worst_contributor, self._market_data))
                    if len(self._market_data) == 0:
                        self.remaining_bounty_rounds = 0
                        self.reward_phase_end_time_s = self._time()
                    else:
                        self.state = MarketState.REWARD_RE_INITIALIZE_MODEL
                else:
                    self._logger.debug("Dividing remaining bounty amongst all remaining contributors.")
                    num_rounds = self.remaining_bounty_rounds
                    self.remaining_bounty_rounds = 0
                    self.reward_phase_end_time_s = self._time()
                    for participant, score in self._scores.items():
                        self._market_balances[participant] += score * num_rounds

    def reveal_init_test_set(self, test_set):
        assert self.state == MarketState.INITIALIZATION
        assert not self._init_test_set_revealed, "The initial test set has already been revealed."
        self.verify_test_set(self.test_reveal_index, test_set)
        self._init_test_set_revealed = True
        self.state = MarketState.PARTICIPATION

    def verify_test_set(self, index, test_set):
        test_set_hash = self.hash_test_set(test_set)
        assert test_set_hash == self.test_dataset_hashes[index]


class PredictionMarketImModule(Module):
    def configure(self, binder):
        self.bind = binder.bind(IncentiveMechanism, to=PredictionMarket)
