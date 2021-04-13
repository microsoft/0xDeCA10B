import itertools
import os
from dataclasses import dataclass, field
from logging import Logger
from pathlib import Path
from typing import Callable, Iterable, List, Tuple

import numpy as np
import pandas as pd
import requests
from injector import ClassAssistedBuilder, Module, inject, provider, singleton
from scipy.sparse import csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.utils import shuffle
from tqdm import tqdm

from .data_loader import DataLoader
from .featuremapping.hashing.token_hash import TokenHash


@inject
@dataclass
class OffensiveDataLoader(DataLoader):
    """
    Load offensive data from https://github.com/t-davidson/hate-speech-and-offensive-language.
    """

    _logger: Logger
    _token_hash: TokenHash

    _seed: int = field(default=2, init=False)
    _train_split: float = field(default=0.7, init=False)
    _max_features: int = field(default=1000, init=False)

    def classifications(self) -> List[str]:
        return ["OFFENSIVE", "SAFE"]

    def load_data(self, train_size: int = None, test_size: int = None) -> (Tuple, Tuple):
        self._logger.info("Loading data.")

        data_folder_path = Path(__file__,
                                '../../../../training_data/offensive/hate-speech-and-offensive-language').resolve()

        if train_size is not None and test_size is not None:
            max_num_samples = train_size + test_size
        else:
            max_num_samples = None
        data_path = data_folder_path / 'labeled_data.csv'

        if not data_path.exists():
            data_url = 'https://github.com/t-davidson/hate-speech-and-offensive-language/raw/master/data/labeled_data.csv'
            self._logger.info("Downloading data from \"%s\" to \"%s\".", data_url, data_path)
            r = requests.get(data_url, allow_redirects=True)
            r.raise_for_status()
            os.makedirs(data_folder_path, exist_ok=True)
            with open(data_path, 'wb') as f:
                f.write(r.content)

        loaded_data = pd.read_csv(data_path)

        data = []
        labels = []
        class_index = list(loaded_data.columns).index('class')
        assert class_index > -1
        for row in tqdm(loaded_data.itertuples(),
                        desc="Loading data",
                        unit_scale=True, mininterval=2, unit=" samples",
                        total=max_num_samples or len(loaded_data),
                        ):
            if max_num_samples is not None and len(data) > max_num_samples:
                break
            text = row.tweet
            # TODO Some extra pre-processing like HTML conversion might be needed.
            data.append(text)
            is_offensive = row[class_index] != 2
            labels.append(1 if is_offensive else 0)

        if train_size is None:
            if test_size is None:
                train_size = int(self._train_split * len(data))
            else:
                train_size = len(data) - test_size
        if test_size is None:
            test_size = len(data) - train_size

        data, labels = shuffle(data, labels, random_state=self._seed)
        x_train = itertools.islice(data, train_size)

        # Compute the top features.
        t = TfidfVectorizer(max_features=self._max_features, norm=None)
        t.fit(tqdm(x_train,
                   desc="Computing top token features",
                   total=train_size,
                   unit_scale=True, mininterval=2,
                   unit=" texts"
                   ))
        top_tokens = t.get_feature_names()
        self._logger.debug("Some top feature names: %s", top_tokens[:10])

        tokenize = t.build_analyzer()
        feature_tokens = set(t.get_feature_names())

        def _featurize(text: str) -> Tuple[int]:
            tokens = [token for token in tokenize(text) if token in feature_tokens]
            result = tuple(self._token_hash.hash(token) for token in tokens)
            return result

        x_train = itertools.islice(data, train_size)
        x_train = self.build_sparse_matrix(_featurize, x_train)
        y_train = np.array(labels[:train_size])

        x_test = itertools.islice(data, len(data) - test_size, len(data))
        x_test = self.build_sparse_matrix(_featurize, x_test)
        y_test = np.array(labels[-test_size:])

        self._logger.info("Done loading data.")
        return (x_train, y_train), (x_test, y_test)

    def build_sparse_matrix(self, featurize: Callable[[str], Tuple[int]], raw_data: Iterable[str]):
        # Make a sparse matrix following the term-document example from:
        # https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.csr_matrix.html
        data = []
        indptr = [0]
        indices = []
        for text in raw_data:
            token_indices = featurize(text)
            indices.extend(token_indices)
            data.extend((1 for _ in range(len(token_indices))))
            indptr.append(len(indices))
        return csr_matrix((data, indices, indptr), dtype=np.uint32)


@dataclass
class OffensiveDataModule(Module):

    @provider
    @singleton
    def provide_data_loader(self, builder: ClassAssistedBuilder[OffensiveDataLoader]) -> DataLoader:
        return builder.build()
