from logging import Logger

import numpy as np
from injector import Binder, inject, Module
from keras.datasets import imdb

from .data_loader import DataLoader


class ImdbDataLoader(DataLoader):
    """
    Load data from IMDB reviews.
    """

    @inject
    def __init__(self, logger: Logger):
        self._logger = logger

    def load_data(self) -> (tuple, tuple):
        num_words = 1000
        self._logger.info("Loading IMDB review data using %d words.", num_words)
        (x_train, y_train), (x_test, y_test) = imdb.load_data(num_words=num_words)

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
