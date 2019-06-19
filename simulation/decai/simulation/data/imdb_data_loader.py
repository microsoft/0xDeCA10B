from dataclasses import dataclass, field
from logging import Logger

import numpy as np
from injector import ClassAssistedBuilder, inject, Module, provider, singleton
from keras.datasets import imdb

from .data_loader import DataLoader


@inject
@dataclass
class ImdbDataLoader(DataLoader):
    """
    Load data from IMDB reviews.
    """

    _logger: Logger
    num_words: int = field(default=1000)

    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
        self._logger.info("Loading IMDB review data using %d words.", self.num_words)
        (x_train, y_train), (x_test, y_test) = imdb.load_data(num_words=self.num_words)
        if train_size is not None:
            x_train, y_train = x_train[:train_size], y_train[:train_size]
        if test_size is not None:
            x_test, y_test = x_test[:test_size], y_test[:test_size]

        def get_features(data):
            result = []
            for x in data:
                xx = np.zeros(self.num_words, dtype='int')
                for v in x:
                    xx[v] = 1
                result.append(xx)
            return result

        x_train_result = get_features(x_train)
        x_test_result = get_features(x_test)

        self._logger.info("Done loading IMDB review data.")
        return (x_train_result, y_train), (x_test_result, y_test)


@dataclass
class ImdbDataModule(Module):
    num_words: int = field(default=1000)

    @provider
    @singleton
    def provide_data_loader(self, builder: ClassAssistedBuilder[ImdbDataLoader]) -> DataLoader:
        return builder.build(num_words=self.num_words)
