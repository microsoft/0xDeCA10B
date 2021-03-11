import os
from dataclasses import dataclass, field
from logging import Logger
from pathlib import Path
from typing import List, Tuple

import numpy as np
import pandas as pd
import requests
from injector import ClassAssistedBuilder, Module, inject, provider, singleton
from scipy.sparse import csr_matrix
from sklearn.utils import shuffle
from spacy.lang.en import English
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
    _seed: int = field(default=2, init=False)
    _train_split: float = field(default=0.7, init=False)
    _token_hash: TokenHash

    # TODO Add options to limit to only the most important (use TF-IDF) tokens.

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

        nlp = English()
        tokenize = nlp.tokenizer

        def _featurize(text: str) -> Tuple[int]:
            tokens = tokenize(text)
            result = tuple(self._token_hash.hash(token.text) for token in tokens)
            return result

        # Make a sparse matrix following the term-document example from:
        # https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.csr_matrix.html
        data = []
        indptr = [0]
        indices = []
        labels = []
        class_index = list(loaded_data.columns).index('class')
        assert class_index > -1
        for row in tqdm(loaded_data.itertuples(),
                        desc="Loading data",
                        unit_scale=True, mininterval=2, unit=" samples",
                        total=max_num_samples or len(loaded_data),
                        ):
            if max_num_samples is not None and len(indptr) > max_num_samples:
                break
            text = row.tweet
            token_indices = _featurize(text)
            indices.extend(token_indices)
            data.extend((1 for _ in range(len(token_indices))))
            indptr.append(len(indices))
            is_offensive = row[class_index] != 2
            labels.append(1 if is_offensive else 0)

        if train_size is None:
            if test_size is None:
                train_size = int(self._train_split * len(data))
            else:
                train_size = len(data) - test_size
        if test_size is None:
            test_size = len(data) - train_size

        data = csr_matrix((data, indices, indptr), dtype=np.uint32)
        data, labels = shuffle(data, labels, random_state=self._seed)
        x_train = data[:train_size]
        y_train = np.array(labels[:train_size])
        x_test = data[-test_size:]
        y_test = np.array(labels[-test_size:])

        self._logger.info("Done loading data.")
        return (x_train, y_train), (x_test, y_test)


@dataclass
class OffensiveDataModule(Module):

    @provider
    @singleton
    def provide_data_loader(self, builder: ClassAssistedBuilder[OffensiveDataLoader]) -> DataLoader:
        return builder.build()
