import unittest
from typing import cast

from injector import Injector

from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.news_data_loader import NewsDataLoader, NewsDataModule
from decai.simulation.logging_module import LoggingModule


class TestNewsDataLoader(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        inj = Injector([
            LoggingModule,
            NewsDataModule,
        ])

        cls.data_loader = inj.get(DataLoader)
        assert isinstance(cls.data_loader, NewsDataLoader)
        cls.data_loader = cast(NewsDataLoader, cls.data_loader)

    @unittest.skip("The dataset does not exist on CI test machine.")
    def test_load_data(self):
        (x_train, y_train), (x_test, y_test) = self.data_loader.load_data()

    def test_entities(self):
        doc = self.data_loader._nlp("December 25, 2019, John Smith walked to a store and bought an apple.")
        actual = self.data_loader._replace_entities(doc)
        self.assertEqual("<DATE>, <PERSON> walked to a store and bought an apple.", actual)
