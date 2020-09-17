import unittest
from typing import cast

from injector import Injector

from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.ttt_data_loader import TicTacToeDataLoader, TicTacToeDataModule
from decai.simulation.logging_module import LoggingModule


class TestTicTacToeDataLoader(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        inj = Injector([
            LoggingModule,
            TicTacToeDataModule,
        ])

        cls.ttt = inj.get(DataLoader)
        assert isinstance(cls.ttt, TicTacToeDataLoader)
        cls.ttt = cast(TicTacToeDataLoader, cls.ttt)

    def test_classifications(self):
        classifications = self.ttt.classifications()
        assert classifications == ["(0, 0)", "(0, 1)", "(0, 2)",
                                   "(1, 0)", "(1, 1)", "(1, 2)",
                                   "(2, 0)", "(2, 1)", "(2, 2)"]

    def test_boards(self):
        (x_train, y_train), (x_test, y_test) = self.ttt.load_data()
        assert x_train.shape[1] == self.ttt.width * self.ttt.length
        assert set(x_train[x_train != 0]) == {1, -1}
        assert x_test.shape[1] == self.ttt.width * self.ttt.length
        assert set(x_test[x_test != 0]) == {1, -1}

        assert set(y_train) <= set(range(9))
        assert set(y_test) <= set(range(9))
