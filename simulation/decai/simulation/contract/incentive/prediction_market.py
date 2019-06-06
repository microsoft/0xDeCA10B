import random
from collections import defaultdict
from dataclasses import dataclass
from enum import Enum
from hashlib import sha256
from logging import Logger
from typing import Dict, List, Tuple

import math
import numpy as np
from injector import inject, Module, singleton

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.data.data_handler import StoredData
from decai.simulation.contract.incentive.incentive_mechanism import IncentiveMechanism
from decai.simulation.contract.objects import Address, Msg, RejectException, TimeMock


class MarketPhase(Enum):
    """ Phases for the current market. """
    # Phases are in chronological order.

    INITIALIZATION = 0
    """ The market is being initialized and awaiting for the requested test set index to be revealed. """

    PARTICIPATION = 1
    """ The market is open to data contributions. """

    REVEAL_TEST_SET = 2
    """ The market will no longer accept data and the test set must be revealed before rewards can be calculated. """

    REWARD = 3
    """ No more data contributions are being accepted but rewards still need to be calculated. """

    REWARD_RE_INITIALIZE_MODEL = 4
    """ Same as `REWARD` but the model needs to be re-initialized. """

    REWARD_COLLECT = 5
    """ The reward values have been computed and are ready to be collected. """


@dataclass
class _Contribution:
    """
    A contribution to train data.
    This is stored for convenience but for some applications, storing the data could be very expensive,
    instead, hashes could be stored and during the reward phase,
    the hash can be used to verify data as data is re-submitted.
    """
    contributor_address: Address
    data: np.array
    classification: int


@singleton
class PredictionMarket(IncentiveMechanism):
    """
    An IM where rewards are computed based on how the model's performance changes with respect to a test set.

    For now, for the purposes of the simulation, the market is only intended to be run once.
    Eventually this class and the actual smart contract implementation of it
    should support restarting the market with a new bounty once a market has ended.
    """

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

        self._market_earliest_end_time_s = None
        self._market_balances: Dict[Address, float] = defaultdict(float)
        """ Keeps track of balances in the market. """

        self._next_data_index = None

        self.state = None

    def distribute_payment_for_prediction(self, sender, value):
        pass

    def end_market(self, test_sets: list):
        """
        Signal the end of the prediction market.

        :param test_sets: The divided test set.
        """
        # TODO Split into separate function calls
        # so that it's more like what would really happen in Ethereum to reduce gas costs.
        assert self.state == MarketPhase.PARTICIPATION
        if self.get_num_contributions_in_market() < self.min_num_contributions \
                and self._time() < self._market_earliest_end_time_s:
            raise RejectException("Can't end the market yet.")

        self._logger.info("Ending market.")
        self.state = MarketPhase.REVEAL_TEST_SET
        self._next_data_index = 0

        all_test_data = []
        for i, test_set in enumerate(test_sets):
            if i != self.test_reveal_index:
                self.verify_test_set(i, test_set)
                all_test_data += test_set

        self._test_data, self._test_labels = list(zip(*all_test_data))
        self.state = MarketPhase.REWARD_RE_INITIALIZE_MODEL

    def get_num_contributions_in_market(self):
        """
        :return: The total number of contributions currently in the market.
            This can decrease as "bad" contributors are removed during the reward phase.
        """
        return len(self._market_data)

    def get_test_set_hashes(self, num_pieces, x_test, y_test) -> Tuple[list, list]:
        """
        Break the test set into `num_pieces` and returns their hashes.

        :param num_pieces: The number of pieces to break the test set into.
        :param x_test: The features for the test set.
        :param y_test: The labels for `x_test`.
        :return: tuple
            A list of `num_pieces` hashes for each portion of the test set.
            The test set divided into `num_pieces`.
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
        assert self.state == MarketPhase.PARTICIPATION
        cost = self.min_stake
        update_model = False
        if cost > msg_value:
            raise RejectException(f"Did not pay enough. Sent {msg_value} < {cost}")
        self._market_data.append(_Contribution(contributor_address, data, classification))
        self._market_balances[contributor_address] += cost
        return (cost, update_model)

    def handle_refund(self, submitter: Address, stored_data: StoredData,
                      claimable_amount: float, claimed_by_submitter: bool,
                      prediction) -> float:
        assert self.remaining_bounty_rounds == 0, "The reward phase has not finished processing contributions."
        assert self.state == MarketPhase.REWARD_COLLECT
        result = self._market_balances[submitter]
        self._logger.debug("Reward for \"%s\": %.2f", submitter, result)
        if result > 0:
            del self._market_balances[submitter]
        else:
            result = 0
        return result

    def handle_report(self, reporter: Address, stored_data: StoredData, claimed_by_reporter: bool, prediction) -> float:
        assert self.state == MarketPhase.REWARD_COLLECT, "The reward phase has not finished processing contributions."
        assert self.remaining_bounty_rounds == 0
        assert self.reward_phase_end_time_s > 0
        if self._time() - self.reward_phase_end_time_s >= self.any_address_claim_wait_time_s:
            submitter = stored_data.sender
            result = self._market_balances[submitter]
            if result > 0:
                self._logger.debug("Giving reward for \"%s\" to \"%s\". Reward: %s", submitter, reporter, result)
                del self._market_balances[reporter]
        else:
            result = 0
        return result

    @staticmethod
    def hash_test_set(test_set):
        """
        :param test_set: A test set.
        :return: The hash of `test_set`.
        """
        return sha256(str(test_set).encode()).hexdigest()

    def initialize_market(self, msg: Msg,
                          x_init_data, y_init_data,
                          test_dataset_hashes: List[str],
                          # Ending criteria:
                          min_length_s: int, min_num_contributions: int) -> int:
        """
        Initialize the prediction market.

        :param msg: Indicates the one posting the bounty and the amount being committed for the bounty.
            The total bounty should be an integer since it also represents the number of "rounds" in the PM.
        :param x_init_data: The data to use to re-initialize the model.
        :param y_init_data: The labels to use to re-initialize the model.
        :param test_dataset_hashes: The committed hashes for the portions of the test set.
        :param min_length_s: The minimum length in seconds of the market.
        :param min_num_contributions: The minimum number of contributions before ending the market.

        :return: The index of the test set that must be revealed.
        """
        assert self._market_earliest_end_time_s is None
        assert self._next_data_index is None, "The market end has already been triggered."
        assert self.state is None

        self.bounty_provider = msg.sender
        self.total_bounty = msg.value
        self.remaining_bounty_rounds = self.total_bounty
        self._x_init_data = x_init_data
        self._y_init_data = y_init_data
        self.test_dataset_hashes = test_dataset_hashes
        assert len(self.test_dataset_hashes) > 1
        self.test_reveal_index = random.randrange(len(self.test_dataset_hashes))
        self.min_stake = 1
        self.min_num_contributions = min_num_contributions
        self.reward_phase_end_time_s = None

        self._market_data = []
        self._market_earliest_end_time_s = self._time() + min_length_s

        self._balances.send(self.bounty_provider, self.owner, self.total_bounty)

        self.state = MarketPhase.INITIALIZATION

        return self.test_reveal_index

    def add_test_set_hashes(self, msg: Msg, more_test_set_hashes: List[str]) -> int:
        """
        Add more hashes for portions of the test set to reveal.
        This helps in case not all hashes can be sent in one transaction.

        :param msg: The message for this transaction.
            The sender must be the bounty provider.
        :param more_test_set_hashes: More committed hashes for the portions of the test set.

        :return: The index of the test set that must be revealed.
        """
        assert self.state == MarketPhase.INITIALIZATION
        assert msg.sender == self.bounty_provider
        # Ensure that a new test set is given and the sender isn't just trying to get a new random index.
        assert len(more_test_set_hashes) > 0, "You must give at least one hash."
        self.test_dataset_hashes += more_test_set_hashes
        self.test_reveal_index = random.randrange(len(self.test_dataset_hashes))
        return self.test_reveal_index

    def process_contribution(self):
        """
        Reward Phase:
        Process the next data contribution.
        """
        assert self.remaining_bounty_rounds > 0, "The market has ended."

        if self.state == MarketPhase.REWARD_RE_INITIALIZE_MODEL:
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

            self.prev_acc = self.model.evaluate(self._test_data, self._test_labels)
            self._logger.debug("Accuracy: %0.2f%%", self.prev_acc * 100)
            self._worst_contributor = None
            self._min_score = math.inf
            self.state = MarketPhase.REWARD
        else:
            assert self.state == MarketPhase.REWARD

        contribution = self._market_data[self._next_data_index]
        self.model.update(contribution.data, contribution.classification)
        self._next_data_index += 1
        need_restart = self._next_data_index >= self.get_num_contributions_in_market()
        if need_restart \
                or self._market_data[self._next_data_index].contributor_address != contribution.contributor_address:
            # Next contributor is different.
            acc = self.model.evaluate(self._test_data, self._test_labels)
            score_change = acc - self.prev_acc
            new_score = self._scores[contribution.contributor_address] + score_change
            self._logger.debug("  Score change for \"%s\": %0.2f (new score: %0.2f)",
                               contribution.contributor_address, score_change, new_score)
            self._scores[contribution.contributor_address] = new_score
            if new_score < self._min_score:
                self._min_score = self._scores[contribution.contributor_address]
                self._worst_contributor = contribution.contributor_address
            elif self._worst_contributor == contribution.contributor_address and score_change > 0:
                # Their score increased, they might not be the worst anymore.
                # Optimize: use a heap.
                self._worst_contributor, self._min_score = min(self._scores.items(), key=lambda x: x[1])

            self.prev_acc = acc
            if need_restart:
                # Find min score and remove that address from the list.
                self._logger.debug("Minimum score: \"%s\": %.2f", self._worst_contributor, self._min_score)
                if self._min_score < 0:
                    num_rounds = self._market_balances[self._worst_contributor] / -self._min_score
                    if num_rounds > self.remaining_bounty_rounds:
                        num_rounds = self.remaining_bounty_rounds
                    self.remaining_bounty_rounds -= num_rounds
                    for participant, score in self._scores.items():
                        self._logger.debug("Score for \"%s\": %.2f", participant, score)
                        self._market_balances[participant] += score * num_rounds
                    self._market_data = list(
                        filter(lambda c: c.contributor_address != self._worst_contributor, self._market_data))
                    if self.get_num_contributions_in_market() == 0:
                        self.state = MarketPhase.REWARD_COLLECT
                        self.remaining_bounty_rounds = 0
                        self.reward_phase_end_time_s = self._time()
                    else:
                        self.state = MarketPhase.REWARD_RE_INITIALIZE_MODEL
                else:
                    self._logger.debug("Dividing remaining bounty amongst all remaining contributors.")
                    num_rounds = self.remaining_bounty_rounds
                    self.remaining_bounty_rounds = 0
                    self.reward_phase_end_time_s = self._time()
                    self.state = MarketPhase.REWARD_COLLECT
                    for participant, score in self._scores.items():
                        self._logger.debug("Score for \"%s\": %.2f", participant, score)
                        self._market_balances[participant] += score * num_rounds

    def reveal_init_test_set(self, test_set_portion):
        """
        Reveal the required portion of the full test set.

        :param test_set_portion: The portion of the test set that must be revealed before started the Participation Phase.
        """
        assert self.state == MarketPhase.INITIALIZATION
        self.verify_test_set(self.test_reveal_index, test_set_portion)
        self.state = MarketPhase.PARTICIPATION

    def verify_test_set(self, index: int, test_set_portion):
        """
        Verify that a portion of the test set matches the committed to hash.

        :param index: The index of the test set in the originally committed list of hashes.
        :param test_set_portion: The portion of the test set to reveal.
        """
        assert 0 <= index < len(self.test_dataset_hashes)
        assert len(test_set_portion) > 0
        test_set_hash = self.hash_test_set(test_set_portion)
        assert test_set_hash == self.test_dataset_hashes[index]


class PredictionMarketImModule(Module):
    def configure(self, binder):
        binder.bind(IncentiveMechanism, to=PredictionMarket)
