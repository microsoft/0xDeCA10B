import random
from collections import defaultdict
from dataclasses import dataclass
from hashlib import sha256
from logging import Logger
from typing import Union

import numpy as np
from injector import Module, inject, singleton

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.data.data_handler import StoredData
from decai.simulation.contract.incentive.incentive_mechanism import IncentiveMechanism
from decai.simulation.contract.objects import Address, RejectException, TimeMock


@singleton
class PredictionMarket(IncentiveMechanism):
    @dataclass
    class Contribution:
        contributor_address: Address
        deposit: Union[int, float]
        data: np.array
        classification: int

    @inject
    def __init__(self,
                 # Injected
                 balances: Balances,
                 logger: Logger,
                 model: Classifier,
                 time_method: TimeMock,
                 # Parameters
                 ):
        super().__init__()

        self._balances = balances
        self._logger = logger
        self.model = model
        self._time = time_method

        self._market_start_time_s = None

        self._init_test_set_revealed = False

    def distribute_payment_for_prediction(self, sender, value):
        pass

    def end_market(self, msg_sender: Address, test_sets: list):
        assert msg_sender == self.initializer_address
        assert self._init_test_set_revealed, "The initial test set has not been revealed."
        if len(self._market_data) < self.min_num_contributions \
                and self._time() < self._market_start_time_s + self.min_length_s:
            raise RejectException("Can't end the market yet.")

        self._logger.info("Ending market.")

        all_test_data = []
        for i, test_set in enumerate(test_sets):
            if i != self.test_reveal_index:
                self.verify_test_set(i, test_set)
                all_test_data += test_set

        test_data, test_labels = list(zip(*all_test_data))

        balances = defaultdict(int)
        """ Keeps track of balances in the market. """

        for contribution in self._market_data:
            balances[contribution.contributor_address] += contribution.deposit

        participants = set(balances.keys())
        remaining_bounty = self.total_bounty
        while remaining_bounty > 0 and len(participants) > 0:
            self._logger.debug("Remaining bounty: %s", remaining_bounty)

            self._logger.debug("Re-initializing model.", )
            self.model.init_model(self._x_init_data, self._y_init_data)

            self._logger.debug("Computing scores.", )
            scores = defaultdict(float)

            prev_acc = self.model.evaluate(test_data, test_labels)
            prev_contributor = None
            for contribution in self._market_data:
                if contribution.contributor_address in participants:
                    self.model.update(contribution.data, contribution.classification)
                    # TODO Don't evaluate if same address is next.
                    acc = self.model.evaluate(test_data, test_labels)
                    score = acc - prev_acc
                    scores[contribution.contributor_address] += score
                    prev_acc = acc

            # Find min score and remove that address from the list.
            contributor_address, min_score = min(scores.items(), key=lambda x: x[1])
            self._logger.debug("Minimum score: \"%s\": %s", contributor_address, min_score)
            if min_score < 0:
                num_rounds = balances[contributor_address] / -min_score
                if num_rounds > remaining_bounty:
                    num_rounds = remaining_bounty
                remaining_bounty -= num_rounds
                for participant in participants:
                    balances[participant] += scores[participant] * num_rounds
                participants.remove(contributor_address)
            else:
                num_rounds = remaining_bounty
                remaining_bounty = 0
                for participant in participants:
                    balances[participant] += scores[participant] * num_rounds
                break

        for contributor, balance in balances.items():
            if balance > 0:
                self._balances.send(self.address, contributor, balance)

        # Signal that no market is running.
        self._market_start_time_s = None

    def handle_add_data(self, contributor_address: Address, msg_value: float, data, classification) -> float:
        result = self.min_stake
        if result > msg_value:
            raise RejectException(f"Did not pay enough. Sent {msg_value} < {result}")
        self._market_data.append(self.Contribution(contributor_address, result, data, classification))
        return result

    def handle_refund(self, submitter: Address, stored_data: StoredData,
                      claimable_amount: float, claimed_by_submitter: bool,
                      prediction) -> float:
        result = 0
        return result

    def handle_report(self, reporter: Address, stored_data: StoredData, claimed_by_reporter: bool, prediction) -> float:
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
        self.initializer_address = initializer_address
        self.total_bounty = total_bounty
        self._x_init_data = x_init_data
        self._y_init_data = y_init_data
        self.test_dataset_hashes = test_dataset_hashes
        self.test_reveal_index = random.randrange(len(self.test_dataset_hashes))
        self.min_stake = 1
        self.min_length_s = min_length_s
        self.min_num_contributions = min_num_contributions

        self._market_data = []
        self._market_start_time_s = self._time()

        self._balances.send(initializer_address, self.address, total_bounty)

        self._init_test_set_revealed = False

        return self.test_reveal_index

    def reveal_init_test_set(self, test_set):
        assert not self._init_test_set_revealed, "The initial test set has already been revealed."
        self.verify_test_set(self.test_reveal_index, test_set)
        self._init_test_set_revealed = True

    def verify_test_set(self, index, test_set):
        test_set_hash = self.hash_test_set(test_set)
        assert test_set_hash == self.test_dataset_hashes[index]


class PredictionMarketImModule(Module):
    def configure(self, binder):
        self.bind = binder.bind(IncentiveMechanism, to=PredictionMarket)
