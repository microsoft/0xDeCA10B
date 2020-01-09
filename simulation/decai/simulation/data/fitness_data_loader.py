import ast
import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from logging import Logger
from pathlib import Path
from typing import Set, Tuple

import numpy as np
from injector import ClassAssistedBuilder, inject, Module, provider, singleton
from sklearn.utils import shuffle
from tqdm import tqdm

from .data_loader import DataLoader


@inject
@dataclass
class FitnessDataLoader(DataLoader):
    """
    Load sport activity data from Endomondo.

    Requires endomondoHR_proper.json from https://sites.google.com/eng.ucsd.edu/fitrec-project/home

    From the first 5K samples, the 2842 'bike' and 2158 'run' occurrences.

    Some info from the fire 10K samples:
    genders: 'male', 'unknown', 'female'
    sports: 'bike', 'bike (transport)', 'run', 'kayaking', 'indoor cycling', 'mountain bike', 'orienteering',
            'core stability training', 'walk', 'cross-country skiing', 'fitness walking', 'roller skiing'
    """

    _logger: Logger
    _seed: int = field(default=2, init=False)
    _train_split: float = field(default=0.7, init=False)
    _classes: Set[str] = field(default_factory=lambda: {'bike', 'run'}, init=False)

    def load_data(self, train_size: int = None, test_size: int = None) -> (Tuple, Tuple):
        self._logger.info("Loading Endomondo fitness data.")
        data = []
        labels = []
        data_folder_path = Path(__file__, '../../../../training_data/fitness')
        user_id_to_set = {}
        sport_to_label = {}
        gender_to_index = {}
        if train_size is not None and test_size is not None:
            max_num_samples = train_size + test_size
        else:
            max_num_samples = 10_000
        classes = '|'.join(self._classes)
        classes_pattern = re.compile(f' \'sport\': \'({classes})\', ')
        with open(data_folder_path / 'endomondoHR_proper.json') as f, \
                tqdm(f,
                     desc="Loading data",
                     unit_scale=True, mininterval=2, unit=" samples",
                     total=max_num_samples,
                     ) as pbar:
            for line in f:
                # TODO Keep users in train set mutually exclusive from users in test set.
                # Check line before more expensive parsing.
                if not classes_pattern.search(line):
                    continue
                record = ast.literal_eval(line)
                sport = record['sport']
                if sport not in self._classes:
                    continue
                if 'speed' not in record:
                    continue
                label = sport_to_label.setdefault(sport, len(sport_to_label))
                labels.append(label)
                heart_rates = record['heart_rate']
                gender = gender_to_index.setdefault(record['gender'], len(gender_to_index))
                speeds = record['speed']
                # Other fields:
                # record['longitude']
                # record['altitude']
                # record['latitude']
                # record['id']
                # record['timestamp']
                # record['userId']
                data.append({
                    # Values to keep as they are:
                    'rawValues':
                        [np.mean(heart_rates) / np.min(heart_rates),
                         np.median(heart_rates) / np.min(heart_rates),
                         np.max(speeds),
                         np.min(speeds),
                         np.mean(speeds),
                         np.median(speeds),
                         ],
                    # Values that need to be converted:
                    'gender': gender,
                })
                pbar.update()
                if len(data) >= max_num_samples:
                    break

        if train_size is None:
            if test_size is None:
                train_size = int(self._train_split * len(data))
            else:
                train_size = len(data) - test_size
        if test_size is None:
            test_size = len(data) - train_size

        # TODO Make sure features can be discretized for Naive Bayes.
        def _featurize(datum):
            gender_one_hot = np.zeros(len(gender_to_index), dtype=np.int)
            gender_one_hot[datum['gender']] = 1
            return np.concatenate([datum['rawValues'], gender_one_hot])

        if self._logger.isEnabledFor(logging.DEBUG):
            self._logger.debug("Labels: %s", Counter(labels))
        data, labels = shuffle(data, labels, random_state=self._seed)
        x_train = np.array([_featurize(d) for d in data[:train_size]])
        y_train = np.array(labels[:train_size])
        x_test = np.array([_featurize(d) for d in data[-test_size:]])
        y_test = np.array(labels[-test_size:])

        self._logger.info("Done loading Endomondo fitness data.")
        return (x_train, y_train), (x_test, y_test)


@dataclass
class FitnessDataModule(Module):

    @provider
    @singleton
    def provide_data_loader(self, builder: ClassAssistedBuilder[FitnessDataLoader]) -> DataLoader:
        return builder.build()
