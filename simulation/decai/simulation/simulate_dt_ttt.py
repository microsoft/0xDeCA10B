import os
import random
import sys
from typing import cast

import math
import numpy as np
from injector import inject, Injector

from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.classification.decision_tree import DecisionTreeModule
from decai.simulation.contract.collab_trainer import DefaultCollaborativeTrainerModule
from decai.simulation.contract.incentive.stakeable import StakeableImModule
from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.ttt_data_loader import TicTacToeDataModule, TicTacToeDataLoader
from decai.simulation.logging_module import LoggingModule
from decai.simulation.simulate import Agent, Simulator

# For `bokeh serve`.
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))


class Runner(object):
    @inject
    def __init__(self,
                 data: DataLoader,
                 simulator: Simulator,
                 ):
        self._data = data
        self._s = simulator

    def run(self):
        init_train_data_portion = 0.10

        # Set up the agents that will act in the simulation.
        agents = [
            # Good
            Agent(address="Good",
                  start_balance=10_000,
                  mean_deposit=5,
                  stdev_deposit=1,
                  mean_update_wait_s=10 * 60,
                  ),
            # Malicious: determined  with the goal of disrupting others.
            Agent(address="Bad",
                  start_balance=10_000,
                  mean_deposit=10,
                  stdev_deposit=3,
                  mean_update_wait_s=1 * 60 * 60,
                  good=False,
                  ),
        ]

        # Start the simulation.
        self._s.simulate(agents,
                         baseline_accuracy=0.647,
                         init_train_data_portion=init_train_data_portion,
                         accuracy_plot_wait_s=math.inf,
                         )


# Run with `bokeh serve PATH`.
if __name__.startswith('bk_script_'):
    # Set up the data, model, and incentive mechanism.
    inj = Injector([
        DecisionTreeModule,
        DefaultCollaborativeTrainerModule,
        LoggingModule,
        StakeableImModule,
        TicTacToeDataModule,
    ])
    inj.get(Runner).run()

if __name__ == '__main__':
    # Play the game.
    inj = Injector([
        DecisionTreeModule,
        DefaultCollaborativeTrainerModule,
        LoggingModule,
        StakeableImModule,
        TicTacToeDataModule,
    ])
    ttt = inj.get(DataLoader)
    assert isinstance(ttt, TicTacToeDataLoader)
    ttt = cast(TicTacToeDataLoader, ttt)
    (x_train, y_train), (x_test, y_test) = ttt.load_data()
    d = inj.get(Classifier)
    d.init_model(x_train, y_train)
    score = d.evaluate(x_train, y_train)
    print(score)
    score = d.evaluate(x_test, y_test)
    print(score)

    b = np.zeros((ttt.width, ttt.length), dtype=np.int8)


    def map_pos(pos):
        assert 0 <= pos < b.size
        return pos // ttt.width, pos % ttt.width


    if random.random() < 0.5:
        # Machine is playing.
        pos = d.predict(b.flatten())
        b[map_pos(pos)] = 1

    m = {0: '#', 1: 'O', -1: 'X'}
    map_symbols = np.vectorize(lambda x: m[x])


    def print_board(board):
        print(np.array2string(map_symbols(board), formatter={'str_kind': lambda x: x}))


    print(f"The machine is O. You are X.\nPositions:\n{np.arange(b.size).reshape(b.shape)}")
    while True:
        # Person's turn.
        print_board(b)
        while True:
            pos = input("Where would you like to go?")
            pos = map_pos(int(pos.strip()))
            if b[pos] == 0:
                b[pos] = -1
                break
            else:
                print("There is already a value there.")

        winner = ttt.get_winner(b)
        if winner is not None:
            print("You WIN!")
            break

        # Machine's turn.
        original_pos = d.predict(b.flatten())
        pos = map_pos(original_pos)
        if b[pos] != 0:
            print(f"Machine picked a spot that already has a marker ({original_pos}). This probably means a draw.")
            print_board(b)
            break
        b[pos] = 1

        winner = ttt.get_winner(b)
        if winner is not None:
            print("You lose :(")
            break
    print_board(b)
