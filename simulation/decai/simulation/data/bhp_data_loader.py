from dataclasses import dataclass
from logging import Logger
from typing import List

from injector import inject, Module
from keras.datasets import boston_housing

from decai.simulation.data.data_loader import DataLoader


@inject
@dataclass
class BhpDataLoader(DataLoader):
    """
    Load data from Boston Housing Prices.

    https://keras.io/datasets/#boston-housing-price-regression-dataset
    """

    _logger: Logger

    def classifications(self) -> List[str]:
        raise NotImplementedError

    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
        self._logger.info("Loading Boston housing prices data.")
        (x_train, y_train), (x_test, y_test) = boston_housing.load_data()
        if train_size is not None:
            x_train, y_train = x_train[:train_size], y_train[:train_size]
        if test_size is not None:
            x_test, y_test = x_test[:test_size], y_test[:test_size]

        self._logger.info("Done loading data.")
        return (x_train, y_train), (x_test, y_test)


@dataclass
class BhpDataModule(Module):

    def configure(self, binder):
        binder.bind(DataLoader, to=BhpDataLoader)
