# Objects for all smart contracts.
from dataclasses import dataclass, field
from typing import Optional

from injector import singleton

Address = str
""" An address that can receive funds and participate in training models. """


@dataclass
class Msg:
    """
    A message sent to a smart contract.

    :param sender: The sender's address.
    :param value: Amount sent with the message.
    """
    sender: Address
    # Need to use float since the numbers might be large. They should still actually be integers.
    value: float


class RejectException(Exception):
    """
    The smart contract rejected the transaction.
    """
    pass


class SmartContract(object):
    """
    A fake smart contract.
    """

    def __init__(self):
        self.address: Address = f'{type(self).__name__}-{id(self)}'
        """ The address of this contract. """

        self.owner: Optional[Address] = None
        """ The owner of this contract. """


@singleton
@dataclass
class TimeMock(object):
    """
    Helps fake the current time (in seconds).
    Ideally the value returned is an integer (like `now` in Solidity) but this is not guaranteed.
    Normally in an Ethereum smart contract `now` can be called.
    To speed up simulations, use this class to get the current time.
    """

    _time: float = field(default=0, init=False)

    def __call__(self, *args, **kwargs):
        """ Get the currently set time (in seconds). """
        return self._time

    def add_time(self, amount):
        """ Add `amount` (in seconds) to the current time. """
        self._time += amount

    def set_time(self, time_value):
        """ Set the time to return when `time()` is called. """
        self._time = time_value

    def time(self):
        """ Get the currently set time (in seconds). """
        return self._time
