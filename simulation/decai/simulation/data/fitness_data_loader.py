import ast
import logging
import os
import re
import time
from collections import Counter
from dataclasses import dataclass, field
from logging import Logger
from pathlib import Path
from typing import List, Set, Tuple

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

    Requires endomondoHR_proper.json from https://sites.google.com/eng.ucsd.edu/fitrec-project/home to be stored at simulation/training_data/fitness/endomondoHR_proper.json.

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

    def classifications(self) -> List[str]:
        return ["BIKING", "RUNNING"]

    def load_data(self, train_size: int = None, test_size: int = None) -> (Tuple, Tuple):
        self._logger.info("Loading Endomondo fitness data.")

        # Look for cached data.
        file_identifier = f'fitness-data-{train_size}-{test_size}.npy'
        base_path = Path(os.path.dirname(__file__)) / 'cached_data'
        os.makedirs(base_path, exist_ok=True)
        cache_paths = {
            'x_train': base_path / f'x_train-{file_identifier}',
            'y_train': base_path / f'y_train-{file_identifier}',
            'x_test': base_path / f'x_test-{file_identifier}',
            'y_test': base_path / f'y_test-{file_identifier}'
        }

        # Use if modified in the last day.
        if all([p.exists() for p in cache_paths.values()]) and \
                all([time.time() - p.stat().st_mtime < 60 * 60 * 24 for p in cache_paths.values()]):
            self._logger.info("Loaded cached Endomondo fitness data from %s.", cache_paths)
            return (np.load(cache_paths['x_train']), np.load(cache_paths['y_train'])), \
                   (np.load(cache_paths['x_test']), np.load(cache_paths['y_test']))

        data = []
        labels = []
        data_folder_path = Path(__file__, '../../../../training_data/fitness').resolve()
        user_id_to_set = {}
        sport_to_label = {
            'bike': 0,
            'run': 1
        }
        gender_to_index = {}
        if train_size is not None and test_size is not None:
            max_num_samples = train_size + test_size
        else:
            max_num_samples = 10_000
        classes = '|'.join(self._classes)
        classes_pattern = re.compile(f' \'sport\': \'({classes})\', ')
        data_path = data_folder_path / 'endomondoHR_proper.json'
        assert data_path.exists(), f"See the documentation for how to download the dataset. It must be stored at {data_path}"
        with open(data_path) as f, \
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
                label = sport_to_label[sport]
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
                        [
                            np.mean(heart_rates) / np.min(heart_rates),
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

        # Thresholds for making sure features can be discretized for Naive Bayes.
        # Just use training data to make thresholds.
        thresholds = np.empty(len(data[0]['rawValues']), dtype=np.int32)
        for i in range(len(data[0]['rawValues'])):
            thresholds[i] = np.median([d['rawValues'][i] for d in data[:train_size]])

        def _featurize(datum):
            raw_values = np.array(thresholds < datum['rawValues'], dtype=np.int8)
            gender_one_hot = np.zeros(len(gender_to_index), dtype=np.int8)
            gender_one_hot[datum['gender']] = 1
            return np.concatenate([raw_values, gender_one_hot])

        if self._logger.isEnabledFor(logging.DEBUG):
            self._logger.debug("Labels: %s", Counter(labels))
        data, labels = shuffle(data, labels, random_state=self._seed)
        x_train = np.array([_featurize(d) for d in data[:train_size]])
        y_train = np.array(labels[:train_size])
        x_test = np.array([_featurize(d) for d in data[-test_size:]])
        y_test = np.array(labels[-test_size:])

        np.save(cache_paths['x_train'], x_train, allow_pickle=False)
        np.save(cache_paths['y_train'], y_train, allow_pickle=False)
        np.save(cache_paths['x_test'], x_test, allow_pickle=False)
        np.save(cache_paths['y_test'], y_test, allow_pickle=False)
        self._logger.info("Done loading Endomondo fitness data.")
        return (x_train, y_train), (x_test, y_test)


@dataclass
class FitnessDataModule(Module):

    @provider
    @singleton
    def provide_data_loader(self, builder: ClassAssistedBuilder[FitnessDataLoader]) -> DataLoader:
        return builder.build()
