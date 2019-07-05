import os
from dataclasses import dataclass
from logging import Logger

import numpy as np
import pandas as pd
from injector import inject, Module

from decai.simulation.data.data_loader import DataLoader


@inject
@dataclass
class TitanicDataLoader(DataLoader):
    """
    Load data for Titanic survivors.

    https://www.kaggle.com/c/titanic/data
    """

    _logger: Logger

    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
        self._logger.info("Loading data.")
        data_folder_path = os.path.join(__file__, '../../../../training_data/titanic')
        if not os.path.exists(data_folder_path):
            # TODO Attempt to download the data.
            raise Exception(f"Could not find Titanic dataset at {data_folder_path}"
                            "\nYou must download it from https://www.kaggle.com/c/titanic/data.")

        def _load_data(path):
            data = pd.read_csv(path)
            y = np.array(data['Survived'], np.int8)
            data.drop(['Survived', 'PassengerId', 'Name', 'Ticket', 'Cabin', 'Embarked'], axis=1, inplace=True)
            return np.array(data), y

        x_train, y_train = _load_data(os.path.join(data_folder_path, 'train.csv'))
        x_test, y_test = _load_data(os.path.join(data_folder_path, 'test.csv'))

        if train_size is not None:
            x_train, y_train = x_train[:train_size], y_train[:train_size]
        if test_size is not None:
            x_test, y_test = x_test[:test_size], y_test[:test_size]

        self._logger.info("Done loading IMDB review data.")
        return (x_train, y_train), (x_test, y_test)


@dataclass
class TitanicDataModule(Module):

    def configure(self, binder):
        binder.bind(DataLoader, to=TitanicDataLoader)
