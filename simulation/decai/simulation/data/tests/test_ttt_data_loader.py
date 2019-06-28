import random
import unittest
from dataclasses import dataclass, field
from typing import cast

import numpy as np
from injector import Injector
from sklearn.tree import DecisionTreeClassifier

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

    def test_boards(self):
        (x_train, y_train), (x_test, y_test) = self.ttt.load_data()
        for _ in range(10):
            i = random.randrange(len(x_train))
            print(x_train[i], y_train[i])
        d = DecisionTreeClassifier(random_state=0xDeCA10B)
        d.fit(x_train, y_train)
        score = d.score(x_train, y_train)
        print(score)
        score = d.score(x_test, y_test)
        print(score)


