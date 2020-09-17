from dataclasses import dataclass
from logging import Logger
from typing import List

import numpy as np
from injector import Binder, inject, Module

from decai.simulation.data.data_loader import DataLoader


@inject
@dataclass
class SimpleDataLoader(DataLoader):
    """
    Load simple data for testing.
    """

    _logger: Logger

    def classifications(self) -> List[str]:
        return ["0", "1"]

    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
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

            [0, 0, 4],
            [0, 4, 4],
            [4, 0, 0],

            [-6, 0, 0],
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
        if train_size is not None:
            x_train = x_train[:train_size]
        if test_size is not None:
            x_test = x_test[:test_size]

        y_train = [_ground_truth(x) for x in x_train]
        y_test = [_ground_truth(x) for x in x_test]

        return (x_train, y_train), (x_test, y_test)


class SimpleDataModule(Module):
    """
    Set up a `DataLoader` mainly for testing.
    """

    def configure(self, binder: Binder):
        binder.bind(DataLoader, to=SimpleDataLoader)
