from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict

import numpy as np
from injector import inject, singleton

from decai.simulation.contract.objects import Address, RejectException, SmartContract, TimeMock


@dataclass
class StoredData:
    # Storing the data is not necessary. data: object
    classification: object
    time: int
    sender: str

    # Need to use float since the numbers might be large. They should still actually be integers.
    initial_deposit: float
    """
    The amount that was initially given to deposit this data.
    """

    claimable_amount: float
    """
    The amount of the deposit that can still be claimed.
    """

    claimed_by: Dict[str, bool] = field(default_factory=lambda: defaultdict(bool))


@singleton
class DataHandler(SmartContract):
    """
    Stores added training data and corresponding meta-data.
    """

    @inject
    def __init__(self, time_method: TimeMock):
        super().__init__()
        self._time = time_method
        self._added_data: Dict[tuple: StoredData] = dict()

    def _get_key(self, data, classification, added_time: int, original_author: str):
        if isinstance(data, np.ndarray):
            # The `.tolist()` isn't necessary but is faster.
            data = tuple(data.tolist())
        else:
            data = tuple(data)
        return (data, classification, added_time, original_author)

    def get_data(self, data, classification, added_time: int, original_author: str) -> StoredData:
        """
        :param data: The originally submitted features.
        :param classification: The label originally submitted for `data`.
        :param added_time: The time in seconds for which the data was added.
        :param original_author: The address that originally added the data.
        :return: The stored information for the data.
        """
        key = self._get_key(data, classification, added_time, original_author)
        stored_data: StoredData = self._added_data.get(key)
        return stored_data

    def handle_add_data(self, contributor_address: Address, cost, data, classification):
        """
        Log an attempt to add data

        :param sender: The address of the one attempting to add data
        :param cost: The cost required to add new data.
        :param data: A single sample of training data for the model.
        :param classification: The label for `data`.
        """
        current_time_s = self._time()
        key = self._get_key(data, classification, current_time_s, contributor_address)
        if key in self._added_data:
            raise RejectException("Data has already been added.")
        d = StoredData(classification, current_time_s, contributor_address, cost, cost)
        self._added_data[key] = d

    def handle_refund(self, submitter, data, classification, added_time: int) -> (float, bool, StoredData):
        """
        Log a refund attempt.

        :param submitter: The address of the one attempting a refund.
        :param data: The data for which to attempt a refund.
        :param classification: The label originally submitted for `data`.
        :param added_time: The time in seconds for which the data was added.
        :return:
            The amount that can be claimed for the refund.
            True if the data has already been claimed by `submitter`, otherwise false.
            The stored data.
        """
        stored_data = self.get_data(data, classification, added_time, submitter)
        assert stored_data is not None, "Data not found."
        assert stored_data.sender == submitter, "Data isn't from the sender."
        claimable_amount = stored_data.claimable_amount
        claimed_by_submitter = stored_data.claimed_by[submitter]

        return (claimable_amount, claimed_by_submitter, stored_data)

    def handle_report(self, reporter, data, classification, added_time: int, original_author: str) \
            -> (bool, StoredData):
        """
        Retrieve information about the data to report.

        :param reporter: The address of the one reporting the data.
        :param data: The data to report.
        :param classification: The label originally submitted for `data`.
        :param added_time: The time in seconds for which the data was added.
        :param original_author: The address that originally added the data.
        :return:
            True if the data has already been claimed by `submitter`, otherwise false.
            The stored data.
        """
        stored_data = self.get_data(data, classification, added_time, original_author)
        assert stored_data is not None, "Data not found."
        claimed_by_reporter = stored_data.claimed_by[reporter]

        # The Solidity implementation updates `stored_data.claimed_by` here which is fine.
        # We do not update it here because if an error occurs while attempting a refund,
        # then the change would have to be undone.
        # Instead, `stored_data.claimed_by` is updated in `update_claimable_amount`.

        return (claimed_by_reporter, stored_data)

    def update_claimable_amount(self, receiver: str, stored_data: StoredData, reward_amount: float):
        # The Solidity implementation does the update in another place which is fine for it.
        # Here we only update it once we're sure the refund can be completed successfully.
        stored_data.claimed_by[receiver] = True

        stored_data.claimable_amount -= reward_amount
