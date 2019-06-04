from dataclasses import dataclass
from logging import Logger

import numpy as np
from injector import Binder, inject, Module
from keras.datasets import imdb

from .data_loader import DataLoader


@inject
@dataclass
class ImdbDataLoader(DataLoader):
    """
    Load data from IMDB reviews.
    """

    _logger: Logger

    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
        num_words = 100
        self._logger.info("Loading IMDB review data using %d words.", num_words)
        (x_train, y_train), (x_test, y_test) = imdb.load_data(num_words=num_words)
        if train_size is not None:
            x_train, y_train = x_train[:train_size], y_train[:train_size]
        if test_size is not None:
            x_test, y_test = x_test[:test_size], y_test[:test_size]

        def get_features(data):
            result = []
            for x in data:
                xx = np.zeros(num_words, dtype='int')
                for v in x:
                    xx[v] = 1
                result.append(xx)
            return result

        x_train_result = get_features(x_train)
        x_test_result = get_features(x_test)

        self._logger.info("Done loading IMDB review data.")
        return (x_train_result, y_train), (x_test_result, y_test)


class ImdbDataModule(Module):
    def configure(self, binder: Binder):
        binder.bind(DataLoader, to=ImdbDataLoader)
