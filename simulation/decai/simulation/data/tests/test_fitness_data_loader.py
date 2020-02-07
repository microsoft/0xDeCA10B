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
        self.assertEqual(x_train.shape[0], train_size)
        self.assertEqual(y_train.shape[0], train_size)
        self.assertEqual(x_test.shape[0], test_size)
        self.assertEqual(y_test.shape[0], test_size)
