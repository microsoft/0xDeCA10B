import unittest
from typing import cast

from injector import Injector

from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.featuremapping.hashing.murmurhash3 import MurmurHash3Module
from decai.simulation.data.featuremapping.hashing.token_hash import TokenHash
from decai.simulation.data.offensive_data_loader import OffensiveDataLoader, OffensiveDataModule
from decai.simulation.logging_module import LoggingModule


class TestOffensiveDataLoader(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        inj = Injector([
            LoggingModule,
            MurmurHash3Module,
            OffensiveDataModule,
        ])

        cls.data_loader = inj.get(DataLoader)
        assert isinstance(cls.data_loader, OffensiveDataLoader)
        cls.data_loader = cast(OffensiveDataLoader, cls.data_loader)
        cls.hash = inj.get(TokenHash)

    def test_load(self):
        train_size = 20
        test_size = 10
        (x_train, y_train), (x_test, y_test) = self.data_loader.load_data(train_size=train_size, test_size=test_size)
        assert x_train.shape[0] == train_size
        assert x_train.shape[0] == y_train.shape[0]
        assert x_test.shape[0] == test_size
        assert x_test.shape[0] == y_test.shape[0]

        assert y_train.shape == (train_size,)
        assert y_test.shape == (test_size,)

        # Test some values to help avoid regressions.
        x_train_values_x, x_train_values_y = x_train[0].nonzero()
        self.assertEqual(0, x_train_values_x[0])
        self.assertEqual(495653056, x_train_values_y[0])
        self.assertEqual(1, x_train[x_train_values_x[0], x_train_values_y[0]])

        self.assertEqual(0, x_train_values_x[1])
        self.assertEqual(443377497, x_train_values_y[1])
        self.assertEqual(1, x_train[x_train_values_x[0], x_train_values_y[0]])

        col = self.hash.hash("you")
        self.assertEqual(814527388, col)
        self.assertEqual(2, x_train[1, col])
