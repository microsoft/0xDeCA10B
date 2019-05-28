import random
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
        self._model = model
        self._time = time_method

        self._market_start_time_s = None

    def initialize_market(self, initializer_address: Address, total_bounty: int, test_dataset_hashes: list,
                          # Ending criteria:
                          min_length_s: int, min_num_contributions: int):
        assert self._market_start_time_s is None
        self.initializer_address = initializer_address
        self.total_bounty = total_bounty
        self.test_dataset_hashes = test_dataset_hashes
        self.test_reveal_index = random.randrange(len(test_dataset_hashes))
        self.min_stake = 1
        self.min_length_s = min_length_s
        self.min_num_contributions = min_num_contributions

        self._market_data = []
        self._market_start_time_s = self._time()

        return (self.test_reveal_index)

    def end_market(self, msg_sender: Address, test_datasets: list):
        assert msg_sender == self.initializer_address
        if len(self._market_data) < self.min_length_s and self._time() < self._market_start_time_s + self.min_length_s:
            raise RejectException("Can't end the market yet.")
        # TODO Verify test_datasets matches the hashes.

        # Signal that no market is running.
        self._market_start_time_s = None

    def handle_add_data(self, msg_value: float, data, classification) -> float:
        if msg_value <= self.min_stake:
            raise RejectException("Not enough stake was given.")
        result = self.min_stake
        self._market_data.append((data, classification))
        # TODO
        return result

    def handle_refund(self, submitter: Address, stored_data: StoredData,
                      claimable_amount: float, claimed_by_submitter: bool,
                      prediction) -> float:
        result = 0

        return result

    def handle_report(self, reporter: Address, stored_data: StoredData, claimed_by_reporter: bool, prediction) -> float:
        result = 0
        return result


class StakeableImModule(Module):
    def configure(self, binder):
        self.bind = binder.bind(IncentiveMechanism, to=PredictionMarket)
