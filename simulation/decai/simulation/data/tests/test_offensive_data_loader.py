import unittest
from typing import cast

from injector import Injector

from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.offensive_data_loader import OffensiveDataLoader, OffensiveDataModule
from decai.simulation.logging_module import LoggingModule


class TestOffensiveDataLoader(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        inj = Injector([
            LoggingModule,
            OffensiveDataModule,
        ])

        cls.data_loader = inj.get(DataLoader)
        assert isinstance(cls.data_loader, OffensiveDataLoader)
        cls.data_loader = cast(OffensiveDataLoader, cls.data_loader)

    def test_load(self):
        # TODO train_size=20, test_size=20
        (x_train, y_train), (x_test, y_test) = self.data_loader.load_data()
        assert x_train.shape[0] > 0
        assert x_train.shape[0] == y_train.shape[0]
        assert x_test.shape[0] > 0
        assert x_test.shape[0] == y_test.shape[0]
        
        assert x_train.shape[1] == x_test.shape[1]
        assert y_train.shape[1] == y_test.shape[1]