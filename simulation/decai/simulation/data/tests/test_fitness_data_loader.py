import unittest
from typing import cast

from injector import Injector

from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.fitness_data_loader import FitnessDataLoader, FitnessDataModule
from decai.simulation.logging_module import LoggingModule


class TestFitnessDataLoader(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        inj = Injector([
            LoggingModule,
            FitnessDataModule,
        ])

        cls.loader = inj.get(DataLoader)
        assert isinstance(cls.loader, FitnessDataLoader)
        cls.loader = cast(FitnessDataLoader, cls.loader)

    @unittest.skip("The dataset does not exist on CI test machine.")
    def test_load(self):
        train_size = 70
        test_size = 30
        (x_train, y_train), (x_test, y_test) = self.loader.load_data(train_size, test_size)
        self.assertEqual(train_size, x_train.shape[0])
        self.assertEqual(train_size, y_train.shape[0])
        self.assertEqual(test_size, x_test.shape[0])
        self.assertEqual(test_size, y_test.shape[0])
