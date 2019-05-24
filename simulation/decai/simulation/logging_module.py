import logging
from logging import Logger

from injector import Module, provider, singleton


class LoggingModule(Module):
    def __init__(self, log_level=logging.INFO):
        super().__init__()
        self._log_level = log_level

    @provider
    @singleton
    def provide_logger(self) -> Logger:
        result = logging.Logger('decai')
        result.setLevel(self._log_level)
        f = logging.Formatter('%(asctime)s [%(levelname)s] - %(name)s:%(filename)s:%(funcName)s\n%(message)s')
        h = logging.StreamHandler()
        h.setFormatter(f)
        result.addHandler(h)
        return result
