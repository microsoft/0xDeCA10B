import logging
from dataclasses import dataclass, field
from logging import Logger

from injector import Module, provider, singleton


@dataclass
class LoggingModule(Module):
    # FIXME Just DEBUG for now to find out why PR build is failing.
    _log_level: int = field(default=logging.DEBUG)

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
