import os
from dataclasses import dataclass, field
from logging import Logger

import numpy as np
import pandas as pd
from injector import inject, Module
from sklearn.utils import shuffle

from decai.simulation.data.data_loader import DataLoader


@inject
@dataclass
class TitanicDataLoader(DataLoader):
    """
    Load data for Titanic survivors.

    https://www.kaggle.com/c/titanic/data
    """

    _logger: Logger

    _seed: int = field(default=231, init=False)
    _train_split: float = field(default=0.7, init=False)

    def _get_features(self, data: pd.DataFrame):
        """
        Map the data to numbers.
        Also uses some ideas from https://triangleinequality.wordpress.com/2013/09/08/basic-feature-engineering-with-the-titanic-data/

        :param data: The data without labels.
        :return: The data mapped to numers.
        """
        data.drop(columns=['PassengerId', 'Ticket'], inplace=True)
        # , 'Name', 'Ticket', 'Cabin', 'Embarked'
        title_tuples = (
            (' Mr. ', ' Sir. ', ' Don. ', ' Major. ', ' Capt. ', ' Jonkheer. ', ' Rev. ', ' Col. '),
            (' Mrs. ', ' Countess. ', ' Mme. ', ' Lady. '),
            (' Miss. ', ' Mlle. ', ' Ms. '),
            (' Master. ',),
            (' Dr. ',),
        )
        title_to_num = {
            ' Mr. ': 0,
            ' Mrs. ': 1,
            ' Miss. ': 2,
            ' Master. ': 3,
        }

        def _get_title(row):
            result = None
            name = row['Name']
            for index, titles in enumerate(title_tuples):
                for t in titles:
                    if t in name:
                        result = titles[0]
            if result == ' Dr. ':
                if row['Sex'] == 'male':
                    result = ' Mr. '
                else:
                    result = ' Mrs. '
            assert result is not None, f"No title found in {row}."
            result = title_to_num[result]
            return result

        def _get_cabin(row):
            result = -1
            cabin = row['Cabin']
            if isinstance(cabin, str):
                for c in 'ABCDEFGT':
                    if c in cabin:
                        result = ord(c) - ord('A')
                        break
            return result

        result = []
        for index, row in data.iterrows():
            if row['Sex'] == 'male':
                sex = 0
            else:
                sex = 1

            family_size = row['SibSp'] + row['Parch']
            datum = [
                row['Pclass'],
                sex,
                _get_title(row),
                family_size,

                # These features did not help:
                # _get_cabin(row),
                # row['Age'],
                # row['Parch'],
                # row['SibSp'],
                # row['Fare'],
                # row['Fare'] / (family_size + 1),
            ]
            result.append(datum)

        return result

    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
        self._logger.info("Loading data.")
        data_folder_path = os.path.join(__file__, '../../../../training_data/titanic')
        if not os.path.exists(data_folder_path):
            # TODO Attempt to download the data.
            raise Exception(f"Could not find Titanic dataset at {data_folder_path}"
                            "\nYou must download it from https://www.kaggle.com/c/titanic/data.")

        x_train = pd.read_csv(os.path.join(data_folder_path, 'train.csv'))
        y_train = np.array(x_train['Survived'], np.int8)
        x_train.drop(columns=['Survived'], inplace=True)
        x_train = self._get_features(x_train)

        x_train = np.array(x_train)
        x_train, y_train = shuffle(x_train, y_train, random_state=self._seed)
        train_split = int(len(x_train) * self._train_split)
        x_test, y_test = x_train[train_split:], y_train[train_split:]
        x_train, y_train = x_train[:train_split], y_train[:train_split]

        if train_size is not None:
            x_train, y_train = x_train[:train_size], y_train[:train_size]
        if test_size is not None:
            x_test, y_test = x_test[:test_size], y_test[:test_size]

        self._logger.info("Done loading data.")
        return (x_train, y_train), (x_test, y_test)


@dataclass
class TitanicDataModule(Module):

    def configure(self, binder):
        binder.bind(DataLoader, to=TitanicDataLoader)
