import itertools
import json
import os
import random
from collections import Counter
from dataclasses import dataclass
from enum import Enum
from logging import Logger
from operator import itemgetter
from typing import Optional, Collection, Tuple

import numpy as np
import pandas as pd
import spacy
from injector import ClassAssistedBuilder, inject, Module, provider, singleton
from sklearn.feature_extraction.text import TfidfVectorizer
from tqdm import tqdm

from .data_loader import DataLoader


class Label(Enum):
    RELIABLE = 0
    UNRELIABLE = 1


@dataclass
class News:
    text: Optional[str]
    label: Label


@inject
@dataclass
class _SignalMediaDataLoader(DataLoader):
    """
    INCOMPLETE BECAUSE MAPPING THE SOURCE NAMES TO DOMAIN NAMES IS TRICKY.
    See https://github.com/aldengolab/fake-news-detection/issues/4

    Following logic of https://github.com/aldengolab/fake-news-detection.
    Requires the Signal Media dataset from http://research.signalmedia.co/newsir16/signal-dataset.html to be at
    simulation/training_data/news/sample-1M.jsonl
    and https://github.com/OpenSourcesGroup/opensources with sources.json in simulation/training_data/news/
    """
    _logger: Logger
    _media_types = {'News'}

    def find_source_site(self, source_name: str, sources: Collection[str]) -> Optional[str]:
        """
        :param source_name: The name of the source.
        :param sources: Source domain names.
        :return: The source domain name from `sources` or `None` if no mapping can be found.
        """
        # TODO
        result = None
        return result

    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
        data_folder_path = os.path.join(__file__, '../../../../training_data/news')
        signal_data_path = os.path.join(data_folder_path, 'sample-1M.jsonl')
        if not os.path.exists(signal_data_path):
            raise Exception(f"Could not find the Signal Media dataset at \"{signal_data_path}\"."
                            "\nYou must obtain it from http://research.signalmedia.co/newsir16/signal-dataset.html"
                            f" and follow the instructions to obtain it. Then extract it to \"{signal_data_path}\".")

        sources_path = os.path.join(data_folder_path, 'sources.json')
        if not os.path.exists(sources_path):
            raise Exception(f"Could not find the sources dataset at \"{sources_path}\"."
                            "\nYou must obtain it from https://github.com/OpenSourcesGroup/opensources and put"
                            f" sources.json in \"{data_folder_path}\".")

        with open(sources_path) as f:
            loaded_sources = json.load(f)
        sources = dict()
        for source, info in loaded_sources.items():
            problem_types = (info['type'], info['2nd type'], info['3rd type'])
            sources[source] = set(filter(None, problem_types))
        self._logger.info("Found %d sources with labels.", len(sources))

        # Name: website name in `sources`.
        source_mapping = {}
        not_found_flag = -1
        with open(signal_data_path) as f:
            for index, line in tqdm(enumerate(f),
                                    desc="Filtering news articles",
                                    unit_scale=True, mininterval=2, unit=" articles"
                                    ):
                news = json.loads(line)
                news_id = news['id']
                title = news['title']
                text = news['content']
                source = news['source']
                # media-type is either "News" or "Blog"
                media_type = news['media-type']
                published_date = news['published']
                if media_type not in self._media_types:
                    continue
                source_site = source_mapping.get(source)
                if source_site is None:
                    source_site = self.find_source_site(source, sources)
                    if source_site is not None:
                        source_mapping[source] = source_site
                    else:
                        source_mapping[source] = not_found_flag
                        continue
                elif source_site == not_found_flag:
                    continue
                # TODO Use article and set label.

        with open(os.path.join(data_folder_path, 'source_mapping.json')) as f:
            sorted(source_mapping.items(), key=itemgetter(0))

        self._logger.info("Found %d sources in the articles.", len(source_mapping))

        # TODO Set up output.
        (x_train, y_train), (x_test, y_test) = (None, None), (None, None)
        if train_size is not None:
            x_train, y_train = x_train[:train_size], y_train[:train_size]
        if test_size is not None:
            x_test, y_test = x_test[:test_size], y_test[:test_size]

        self._logger.info("Done loading news data.")
        return (x_train, y_train), (x_test, y_test)


@inject
@dataclass
class NewsDataLoader(DataLoader):
    """
    Load data from news sources.
    """

    _logger: Logger
    _train_split = 0.7
    _nlp = spacy.load('en_core_web_lg', disable={'tagger', 'parser', 'textcat'})
    _replace_entities = False
    """
    If True, entities will be replaced in text with the entity's label surrounded by angle brackets: "<LABEL>".
    Accuracy with replacement: 0.9172
    Accuracy without replacement: 0.9173

    Disabled because using spaCy is slow, it will be tricky to use spaCy in JavaScript,
    and it didn't change the evaluation metrics much.
    """

    _entity_types_to_replace = {'PERSON', 'GPE', 'ORG', 'DATE', 'TIME', 'PERCENT',
                                'MONEY', 'QUANTITY', 'ORDINAL', 'CARDINAL'}

    def _load_kaggle_data(self, data_folder_path: str) -> Collection[News]:
        """
        Load data from https://www.kaggle.com/c/fake-news/data.
        """
        # Don't use the test data because it has no labels.
        fake_news_data_path = os.path.join(data_folder_path, 'fake-news', 'train.csv')
        if not os.path.exists(fake_news_data_path):
            raise Exception(f"Could not find the Fake News dataset at \"{fake_news_data_path}\"."
                            "\nYou must obtain it from https://www.kaggle.com/c/fake-news/data.")
        data = pd.read_csv(fake_news_data_path, na_values=dict(text=[]), keep_default_na=False)
        result = []
        for row in data.itertuples():
            label = Label.RELIABLE if row.label == 0 else Label.UNRELIABLE
            if len(row.text) > 0:
                result.append(News(row.text, label))

        # Consistent shuffle to aim for a mostly even distribution of labels.
        random.shuffle(result, lambda: 0.618)

        return result

    def _pre_process_text(self, doc) -> str:
        # TODO Remove name of news sources.
        if self._replace_entities:
            # Remove names in text using spaCy.
            result = doc.text
            for ent in doc.ents[::-1]:
                if ent.label_ in self._entity_types_to_replace:
                    result = result[:ent.start_char] + "<" + ent.label_ + ">" + result[ent.end_char:]
        else:
            assert isinstance(doc, str)
            result = doc
        return result

    def _pre_process(self, news_articles: Collection[News], train_size: int, test_size: int) -> \
            Tuple[Tuple[np.ndarray, np.ndarray], Tuple[np.ndarray, np.ndarray]]:
        self._logger.info("Getting features for %d articles.", len(news_articles))
        # Only use binary features.
        ngram_range = (2, 2)
        t = TfidfVectorizer(max_features=3000, ngram_range=ngram_range)
        test_start = len(news_articles) - test_size

        x_train = map(lambda news: news.text, itertools.islice(news_articles, train_size))
        x_test = map(lambda news: news.text, itertools.islice(news_articles, test_start, len(news_articles)))
        if self._replace_entities:
            x_train = self._nlp.pipe(x_train, batch_size=128)
            x_test = self._nlp.pipe(x_test, batch_size=128)

        x_train = map(self._pre_process_text, x_train)
        x_test = map(self._pre_process_text, x_test)

        x_train = t.fit_transform(tqdm(x_train,
                                       desc="Processing training data",
                                       total=train_size,
                                       unit_scale=True, mininterval=2,
                                       unit=" articles"
                                       )).toarray()
        x_test = t.transform(tqdm(x_test,
                                  desc="Processing testing data",
                                  total=test_size,
                                  unit_scale=True, mininterval=2,
                                  unit=" articles"
                                  )).toarray()

        y_train = np.array([news.label.value for news in itertools.islice(news_articles, train_size)], np.int8)
        y_test = np.array([news.label.value for news in itertools.islice(news_articles,
                                                                         test_start, len(news_articles))], np.int8)
        self._logger.debug("Training labels: %s", Counter(y_train))
        self._logger.debug("Test labels: %s", Counter(y_test))
        self._logger.info("Done getting features.")
        return (x_train, y_train), (x_test, y_test)

    def load_data(self, train_size: int = None, test_size: int = None) -> \
            Tuple[Tuple[np.ndarray, np.ndarray], Tuple[np.ndarray, np.ndarray]]:
        self._logger.info("Loading news data.")
        data_folder_path = os.path.join(__file__, '../../../../training_data/news')

        data = self._load_kaggle_data(data_folder_path)

        #  Separate train and test data.
        if train_size is None:
            if test_size is None:
                train_size = int(self._train_split * len(data))
            else:
                train_size = len(data) - test_size
        if test_size is None:
            test_size = len(data) - train_size
        if train_size + test_size > len(data):
            raise Exception("There is not enough data for the requested sizes."
                            f"\n  data size: {len(data)}"
                            f"\n  train size: {train_size}"
                            f"\n  test size: {test_size}")

        (x_train, y_train), (x_test, y_test) = self._pre_process(data, train_size, test_size)
        self._logger.info("Done loading news data.")
        return (x_train, y_train), (x_test, y_test)


@dataclass
class NewsDataModule(Module):

    @provider
    @singleton
    def provide_data_loader(self, builder: ClassAssistedBuilder[NewsDataLoader]) -> DataLoader:
        return builder.build()
