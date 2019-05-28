import random
from hashlib import sha256
from logging import Logger

from injector import Module, inject, singleton

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.data.data_handler import StoredData
from decai.simulation.contract.incentive.incentive_mechanism import IncentiveMechanism
from decai.simulation.contract.objects import Address, RejectException, TimeMock


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
        if len(self._market_data) < self.min_length_s and self._time() < self._market_start_time_s + self.min_length_s:
            raise RejectException("Can't end the market yet.")
        for i, test_set in enumerate(test_sets):
            if i != self.test_reveal_index:
                self.verify_test_set(i, test_set)

        # TODO Distribute bounty.

        # Signal that no market is running.
        self._market_start_time_s = None

    def handle_add_data(self, msg_value: float, data, classification) -> float:
        if msg_value <= self.min_stake:
            raise RejectException("Not enough stake was given.")
        result = self.min_stake
        self._market_data.append((data, classification))
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

    def initialize_market(self, initializer_address: Address, total_bounty: int, test_dataset_hashes: list,
                          # Ending criteria:
                          min_length_s: int, min_num_contributions: int):
        assert self._market_start_time_s is None
        self.initializer_address = initializer_address
        self.total_bounty = total_bounty
        self.test_dataset_hashes = test_dataset_hashes
        self.test_reveal_index = random.randrange(len(self.test_dataset_hashes))
        self.min_stake = 1
        self.min_length_s = min_length_s
        self.min_num_contributions = min_num_contributions

        self._market_data = []
        self._market_start_time_s = self._time()

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
