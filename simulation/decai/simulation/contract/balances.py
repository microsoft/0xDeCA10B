from logging import Logger
from typing import Dict

from injector import inject, singleton

from decai.simulation.contract.objects import Address


@singleton
class Balances(object):
    @inject
    def __init__(self,
                 logger: Logger):
        self._balances: Dict[Address: float] = dict()
        self._logger = logger

    def __contains__(self, address: Address):
        return address in self._balances

    def __getitem__(self, address: Address) -> float:
        return self._balances[address]

    def get_all(self):
        return dict(self._balances)

    def initialize(self, address: Address, start_balance: float):
        assert address not in self._balances, f"'{address}' already has a balance."
        self._balances[address] = start_balance

    def send(self, sending_address: Address, receiving_address: Address, amount):
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
