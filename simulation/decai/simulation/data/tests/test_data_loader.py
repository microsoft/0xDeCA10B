from logging import Logger

import numpy as np
from injector import Binder, inject, Module

from ..data_loader import DataLoader


class TestDataLoader(DataLoader):
    """
    Load test data.
    """

    @inject
    def __init__(self, logger: Logger):
        self._logger = logger

    def load_data(self) -> (tuple, tuple):
        def _ground_truth(data):
            if data[0] * data[2] > 0:
                return 1
            else:
                return 0

        x_train = np.array([
            [0, 0, 0],
            [1, 1, 1],

            [0, 0, 1],
            [0, 1, 0],
            [0, 1, 1],
            [1, 0, 0],
            [1, 0, 1],
            [1, 1, 0],

            [0, 0, 2],
            [0, 2, 0],
            [2, 0, 0],
            [2, 0, 2],

            [0, 0, -3],
            [0, 3, 0],
            [0, 3, -3],
            [0, -3, 3],
        ])
        x_test = np.array([
            [0, 2, 2],
            [0, 1, -1],
            [-1, 0, 0],
            [0, -1, 0],
            [1, -1, 2],
            [0, 0, 3],
            [0, -2, 0],
            [0, 2, -2],
            [3, 0, 0],
            [-2, 0, 2],
            [2, -2, 0],

        ])
        y_train = [_ground_truth(x) for x in x_train]
        y_test = [_ground_truth(x) for x in x_test]

        return (x_train, y_train), (x_test, y_test)


class TestDataModule(Module):
    def configure(self, binder: Binder):
        binder.bind(DataLoader, to=TestDataLoader)
