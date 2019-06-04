# Objects for all smart contracts.
from dataclasses import dataclass
from typing import Optional
from unittest.mock import Mock

from injector import inject, singleton

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
class TimeMock(object):
    """
    Helps fake the current time.
    Normally in an Ethereum smart contract `now` can be called.
    To speed up simulations, use this class to get the current time.
    """

    @inject
    def __init__(self):
        self._time_method: Mock = Mock(name='time', return_value=0)

    def set_time(self, time_value):
        """ Set the time to return when `time()` is called. """
        self._time_method.return_value = time_value

    def time(self):
        """ Get the currently set time. """
        return self._time_method()

    def __call__(self, *args, **kwargs):
        """ Get the currently set time. """
        return self.time()
