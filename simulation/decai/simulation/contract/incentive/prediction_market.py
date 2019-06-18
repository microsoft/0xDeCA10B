import random
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from enum import Enum
from hashlib import sha256
from logging import Logger
from typing import Dict, List, Optional, Tuple

import math
import numpy as np
from injector import ClassAssistedBuilder, inject, Module, provider, singleton

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

    REWARD_RESTART = 4
    """
    Same as `REWARD` but contributions have just been filtered out 
    and the iteration needs to restart with the remaining contributions.
    """

    REWARD_COLLECT = 5
    """ The reward values have been computed and are ready to be collected. """


@dataclass
class _Contribution:
    """
    A contribution to train data.

    This is stored for convenience but for some applications, storing the data could be very expensive,
    instead, hashes could be stored and during the reward phase,
    the hash can be used to verify data as data is re-submitted.
    Note: this is not in the spirit of the prediction market (the current state should be public)
    since the model would not actually be updated and the submitted data would be private
    so new data contributors have very limited information.
    """
    contributor_address: Address
    data: np.array
    classification: int

    balance: int
    """
    Initially this is the amount deposited with this contribution.
    If contributions are not grouped by contributor, then while calculating rewards this gets updated to be the balance
    for this particular contribution, to know if it should get kicked out of the reward phase.  
    """

    score: Optional[int] = field(default=None, init=False)
    """
    The score for this contribution.
    Mainly used for when contributions are not grouped.
    """

    accuracy: Optional[float] = field(default=None, init=False)
    """ The accuracy of the model on the test set after adding this contribution. """


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
                 any_address_claim_wait_time_s=60 * 60 * 24 * 7,

                 # Configuration Options
                 allow_greater_deposit=False,
                 group_contributions=False,
                 reset_model_during_reward_phase=False,
                 ):
        super().__init__(any_address_claim_wait_time_s=any_address_claim_wait_time_s)

        self._balances = balances
        self._logger = logger
        self.model = model
        self._time = time_method

        # Configuration Options
        self._allow_greater_deposit = allow_greater_deposit
        self._group_contributions = group_contributions
        self._reset_model_during_reward_phase = reset_model_during_reward_phase

        self._market_earliest_end_time_s = None
        self._market_balances: Dict[Address, float] = defaultdict(float)
        """ Keeps track of balances in the market. """

        self._next_data_index = None

        self.min_stake = 1
        """
        The minimum required amount to deposit.
        Should be at least 1 to handle the worst case where the contribution takes the accuracy from 1 to 0. 
        """

        self.state = None

    def distribute_payment_for_prediction(self, sender, value):
        pass

    def get_num_contributions_in_market(self):
        """
        :return: The total number of contributions currently in the market.
            This can decrease as "bad" contributors are removed during the reward phase.
        """
        return len(self._market_data)

    # Methods in chronological order of the PM.
    @staticmethod
    def hash_test_set(test_set):
        """
        :param test_set: A test set.
        :return: The hash of `test_set`.
        """
        return sha256(str(test_set).encode()).hexdigest()

    @staticmethod
    def get_test_set_hashes(num_pieces, x_test, y_test) -> Tuple[list, list]:
        """
        Helper to break the test set into `num_pieces` to initialize the market.

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
            test_dataset_hashes.append(PredictionMarket.hash_test_set(test_set))
        assert sum(len(t) for t in test_sets) == len(x_test)
        return test_dataset_hashes, test_sets

    def initialize_market(self, msg: Msg,
                          test_dataset_hashes: List[str],
                          # Ending criteria:
                          min_length_s: int, min_num_contributions: int) -> int:
        """
        Initialize the prediction market.

        :param msg: Indicates the one posting the bounty and the amount being committed for the bounty.
            The total bounty should be an integer since it also represents the number of "rounds" in the PM.
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
        self.test_set_hashes = test_dataset_hashes
        assert len(self.test_set_hashes) > 1
        self.test_reveal_index = random.randrange(len(self.test_set_hashes))
        self.next_test_set_index_to_verify = 0
        if self.next_test_set_index_to_verify == self.test_reveal_index:
            self.next_test_set_index_to_verify += 1

        self._market_data: List[_Contribution] = []
        self.min_num_contributions = min_num_contributions
        self._market_earliest_end_time_s = self._time() + min_length_s

        self.reward_phase_end_time_s = None

        self.prev_acc = None
        self.original_acc = None

        # Pay the owner since it will be the owner distributing funds using `handle_refund` and `handle_reward` later.
        self._balances.send(self.bounty_provider, self.owner, self.total_bounty)

        self.state = MarketPhase.INITIALIZATION

        return self.test_reveal_index

    def add_test_set_hashes(self, msg: Msg, more_test_set_hashes: List[str]) -> int:
        """
        (Optional)
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
        self.test_set_hashes += more_test_set_hashes
        self.test_reveal_index = random.randrange(len(self.test_set_hashes))
        self.next_test_set_index_to_verify = 0
        if self.next_test_set_index_to_verify == self.test_reveal_index:
            self.next_test_set_index_to_verify += 1
        return self.test_reveal_index

    def verify_test_set(self, index: int, test_set_portion):
        """
        Verify that a portion of the test set matches the committed to hash.

        :param index: The index of the test set in the originally committed list of hashes.
        :param test_set_portion: The portion of the test set to reveal.
        """
        assert 0 <= index < len(self.test_set_hashes)
        assert len(test_set_portion) > 0
        test_set_hash = self.hash_test_set(test_set_portion)
        assert test_set_hash == self.test_set_hashes[index]

    def reveal_init_test_set(self, test_set_portion):
        """
        Reveal the required portion of the full test set.

        :param test_set_portion: The portion of the test set that must be revealed before started the Participation Phase.
        """
        assert self.state == MarketPhase.INITIALIZATION
        self.verify_test_set(self.test_reveal_index, test_set_portion)
        self.state = MarketPhase.PARTICIPATION

    def handle_add_data(self, contributor_address: Address, msg_value: float, data, classification) -> (float, bool):
        # Allow them to stake as much as they want to ensure they get included in future rounds.
        assert self.state == MarketPhase.PARTICIPATION
        if msg_value < self.min_stake:
            raise RejectException(f"Did not pay enough. Sent {msg_value} < {self.min_stake}")
        if self._allow_greater_deposit:
            cost = msg_value
        else:
            cost = self.min_stake
        update_model = False
        self._market_data.append(_Contribution(contributor_address, data, classification, cost))
        self._market_balances[contributor_address] += cost
        return (cost, update_model)

    def end_market(self):
        """
        Signal the end of the prediction market.
        """
        assert self.state == MarketPhase.PARTICIPATION
        if self.get_num_contributions_in_market() < self.min_num_contributions \
                and self._time() < self._market_earliest_end_time_s:
            raise RejectException("Can't end the market yet.")

        self._logger.info("Ending market.")
        self.state = MarketPhase.REVEAL_TEST_SET
        self._next_data_index = 0
        self.test_data, self.test_labels = [], []

    def verify_next_test_set(self, test_set_portion):
        assert self.state == MarketPhase.REVEAL_TEST_SET
        self.verify_test_set(self.next_test_set_index_to_verify, test_set_portion)
        test_data, test_labels = zip(*test_set_portion)
        self.test_data += test_data
        self.test_labels += test_labels
        self.next_test_set_index_to_verify += 1
        if self.next_test_set_index_to_verify == self.test_reveal_index:
            self.next_test_set_index_to_verify += 1
        if self.next_test_set_index_to_verify == len(self.test_set_hashes):
            self.state = MarketPhase.REWARD_RESTART

    def process_contribution(self):
        """
        Reward Phase:
        Process the next data contribution.
        """
        assert self.remaining_bounty_rounds > 0, "The market has ended."

        if self.state == MarketPhase.REWARD_RESTART:
            self._next_data_index = 0
            self._logger.debug("Remaining bounty rounds: %s", self.remaining_bounty_rounds)
            self._scores = defaultdict(float)

            if self._reset_model_during_reward_phase:
                # The paper implies that we should not retrain the model and instead only train once.
                # The problem there is that a contributor is affected by bad contributions
                # between them and the last counted contribution after bad contributions are filtered out.
                self.model.reset_model()

            if self.prev_acc is None:
                # XXX This evaluation can be expensive and likely won't work in Ethereum.
                # We need to find a more efficient way to do this or let a contributor proved they did it.
                self.prev_acc = self.model.evaluate(self.test_data, self.test_labels)
                self.original_acc = self.prev_acc
                self._logger.debug("Accuracy: %0.2f%%", self.prev_acc * 100)
            elif not self._reset_model_during_reward_phase:
                # When calculating rewards, the score, the same accuracy for the initial model should be used.
                self.prev_acc = self.original_acc

            self._num_market_contributions: Dict[Address, int] = Counter()
            self._worst_contribution: Optional[_Contribution] = None
            self._worst_contributor: Optional[Address] = None
            self._min_score = math.inf
            self.state = MarketPhase.REWARD
        else:
            assert self.state == MarketPhase.REWARD

        contribution = self._market_data[self._next_data_index]
        self._num_market_contributions[contribution.contributor_address] += 1
        self.model.update(contribution.data, contribution.classification)
        if not self._reset_model_during_reward_phase and contribution.accuracy is None:
            # XXX Potentially expensive gas cost.
            contribution.accuracy = self.model.evaluate(self.test_data, self.test_labels)

        self._next_data_index += 1
        iterated_through_all_contributions = self._next_data_index >= self.get_num_contributions_in_market()

        if iterated_through_all_contributions \
                or not self._group_contributions \
                or self._market_data[self._next_data_index].contributor_address != contribution.contributor_address:
            # Need to compute score.

            if self._reset_model_during_reward_phase:
                # XXX Potentially expensive gas cost.
                acc = self.model.evaluate(self.test_data, self.test_labels)
            else:
                acc = contribution.accuracy

            score_change = acc - self.prev_acc
            if self._group_contributions:
                new_score = self._scores[contribution.contributor_address] = \
                    self._scores[contribution.contributor_address] + score_change
            else:
                new_score = contribution.score = score_change

            if new_score < self._min_score:
                self._min_score = new_score
                if self._group_contributions:
                    self._worst_contributor = contribution.contributor_address
                else:
                    self._worst_contribution = contribution
            elif self._group_contributions and self._worst_contributor == contribution.contributor_address:
                # Their score increased, they might not be the worst anymore.
                # Optimize: use a heap.
                self._worst_contributor, self._min_score = min(self._scores.items(), key=lambda x: x[1])

            self.prev_acc = acc
            if iterated_through_all_contributions:
                # Find min score and remove that address from the list.
                self._logger.debug("Minimum score: %.2f", self._min_score)
                if self._min_score < 0:
                    if self._group_contributions:
                        num_rounds = self._market_balances[self._worst_contributor] / -self._min_score
                    else:
                        num_rounds = self._worst_contribution.balance / -self._min_score

                    if num_rounds > self.remaining_bounty_rounds:
                        num_rounds = self.remaining_bounty_rounds

                    self._logger.debug("Will simulate %.2f rounds.", num_rounds)

                    self.remaining_bounty_rounds -= num_rounds
                    if self.remaining_bounty_rounds == 0:
                        self._end_reward_phase(num_rounds)
                    else:
                        if self._group_contributions:
                            participants_to_remove = set()
                            for participant, score in self._scores.items():
                                self._logger.debug("Score for \"%s\": %.2f", participant, score)
                                self._market_balances[participant] += score * num_rounds
                                if self._market_balances[participant] < self._num_market_contributions[participant]:
                                    # They don't have enough left to stake next time.
                                    participants_to_remove.add(participant)
                            self._market_data: List[_Contribution] = list(
                                filter(lambda c: c.contributor_address not in participants_to_remove,
                                       self._market_data))
                        else:
                            for contribution in self._market_data:
                                contribution.balance += contribution.score * num_rounds
                                if contribution.balance < 1:
                                    # Contribution is going to get kicked out.
                                    self._market_balances[contribution.contributor_address] += contribution.balance
                            self._market_data: List[_Contribution] = \
                                list(filter(lambda c: c.balance >= 1, self._market_data))
                        if self.get_num_contributions_in_market() == 0:
                            self.state = MarketPhase.REWARD_COLLECT
                            self.remaining_bounty_rounds = 0
                            self.reward_phase_end_time_s = self._time()
                        else:
                            self.state = MarketPhase.REWARD_RESTART
                else:
                    num_rounds = self.remaining_bounty_rounds
                    self.remaining_bounty_rounds = 0
                    self._end_reward_phase(num_rounds)

    def _end_reward_phase(self, num_rounds):
        """
        Distribute rewards.

        :param num_rounds: The number of rounds remaining.
        """
        self._logger.debug("Dividing remaining bounty amongst all remaining contributors to simulate %.2f rounds.",
                           num_rounds)
        self.reward_phase_end_time_s = self._time()
        self.state = MarketPhase.REWARD_COLLECT
        if self._group_contributions:
            for participant, score in self._scores.items():
                self._logger.debug("Score for \"%s\": %.2f", participant, score)
                self._market_balances[participant] += score * num_rounds
        else:
            for contribution in self._market_data:
                self._market_balances[contribution.contributor_address] = \
                    contribution.score * num_rounds

        self._market_data = []

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


@dataclass
class PredictionMarketImModule(Module):
    allow_greater_deposit: bool = field(default=False)
    group_contributions: bool = field(default=False)
    reset_model_during_reward_phase: bool = field(default=False)

    @provider
    def provide_data_loader(self, builder: ClassAssistedBuilder[PredictionMarket]) -> IncentiveMechanism:
        return builder.build(
            allow_greater_deposit=self.allow_greater_deposit,
            group_contributions=self.group_contributions,
            reset_model_during_reward_phase=self.reset_model_during_reward_phase,
        )
