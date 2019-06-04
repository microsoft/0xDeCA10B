from dataclasses import dataclass, field
from logging import Logger
from typing import Dict

from injector import inject, singleton

from decai.simulation.contract.objects import Address


@inject
@singleton
@dataclass
class Balances(object):
    """
    Tracks balances in the simulation.
    """

    _logger: Logger

    _balances: Dict[Address, float] = field(default_factory=dict, init=False)

    def __contains__(self, address: Address):
        """
        :param address: A participant's address.
        :return: `True` if the address is in the simulation, `False` otherwise.
        """
        return address in self._balances

    def __getitem__(self, address: Address) -> float:
        """
        :param address: A participant's address.
        :return: The balance for `address`.
        """
        return self._balances[address]

    def get_all(self) -> Dict[Address, float]:
        """
        :return: A copy of the balances.
        """
        return dict(self._balances)

    def initialize(self, address: Address, start_balance: float):
        """ Initialize a participant's balance. """
        assert address not in self._balances, f"'{address}' already has a balance."
        self._balances[address] = start_balance

    def send(self, sending_address: Address, receiving_address: Address, amount):
        """ Send funds from one participant to another. """
        assert amount >= 0
        if amount > 0:
            sender_balance = self._balances[sending_address]
            if sender_balance < amount:
                self._logger.warning(f"'{sending_address} has {sender_balance} < {amount}.\n"
                                     f"Will only send {sender_balance}.")
                amount = sender_balance

            self._balances[sending_address] -= amount
            if receiving_address not in self._balances:
                self.initialize(receiving_address, amount)
            else:
                self._balances[receiving_address] += amount
