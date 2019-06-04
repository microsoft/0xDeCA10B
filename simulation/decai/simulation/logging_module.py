import logging
from dataclasses import dataclass, field
from logging import Logger

from injector import Module, provider, singleton


@dataclass
class LoggingModule(Module):
    _log_level: int = field(default=logging.INFO)

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
