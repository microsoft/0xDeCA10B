# Objects for all smart contracts.
from dataclasses import dataclass
from unittest.mock import Mock

from injector import inject, singleton


@dataclass
class Msg:
    """
    A message sent to a smart contract.

    :param sender: The sender's address.
    :param value: Amount sent with the message.
    """
    sender: str
    # Need to use float since the numbers might be large. They should still actually be integers.
    value: float


class RejectException(Exception):
    pass


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
        self._time_method.return_value = time_value

    def time(self):
        return self._time_method()

    def __call__(self, *args, **kwargs):
        return self.time()
