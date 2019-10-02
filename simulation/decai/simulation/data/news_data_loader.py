import json
import os
from dataclasses import dataclass
from enum import auto, Enum
from logging import Logger
from operator import itemgetter
from typing import Optional, Collection

import pandas as pd
from injector import ClassAssistedBuilder, inject, Module, provider, singleton
from sklearn.feature_extraction.text import TfidfVectorizer
from tqdm import tqdm

from .data_loader import DataLoader


class Label(Enum):
    RELIABLE = auto()
    UNRELIABLE = auto()


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

        return result

    def _pre_process_title(self, title: str) -> str:
        # TODO Remove names in text using spaCy.
        # TODO Remove name of news sources.
        result = title.lower()
        return result

    def _pre_process_text(self, text: str) -> str:
        # TODO Remove names in text using spaCy.
        # TODO Remove name of news sources.
        result = text.lower()
        return result

    def _pre_process(self, news_articles: Collection[News], train_size: int, test_size: int) -> (tuple, tuple):
        self._logger.info("Getting feature for %d articles.", len(news_articles))
        t = TfidfVectorizer(stop_words='english', max_features=3000)
        train_data = news_articles[:train_size]
        test_data = news_articles[-test_size:]
        x_train = t.fit_transform([news.text for news in train_data])
        y_train = [news.label.value for news in train_data]
        x_test = t.transform([news.text for news in test_data])
        y_test = [news.label.value for news in test_data]
        self._logger.info("Done getting features.")
        return (x_train, y_train), (x_test, y_test)

    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
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
