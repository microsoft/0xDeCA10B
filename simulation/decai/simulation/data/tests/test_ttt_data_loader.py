from injector import Injector
import unittest
from decai.simulation.data.ttt_data_loader import TicTacToeDataLoader, TicTacToeDataModule
from decai.simulation.logging_module import LoggingModule


class TestTicTacToeDataLoader(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        inj = Injector([
            LoggingModule,
            TicTacToeDataModule,
        ])

        cls.ttt = inj.get(TicTacToeDataLoader)

    def test_boards(self):
        (x_train, y_train), (x_test, y_test) = self.ttt.load_data()
