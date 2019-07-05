import json
import os
import random
import sys
from collections import Counter
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
                         baseline_accuracy=0.44,
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


def _map_pos(tic_tac_toe, board, pos):
    assert 0 <= pos < board.size
    return pos // tic_tac_toe.width, pos % tic_tac_toe.width


def play_game(classifier, tic_tac_toe):
    board = np.zeros((tic_tac_toe.width, tic_tac_toe.length), dtype=np.int8)

    if random.random() < 0.5:
        # Machine is playing.
        pos = classifier.predict(board.flatten())
        board[_map_pos(tic_tac_toe, board, pos)] = 1
    m = {0: '#', 1: 'O', -1: 'X'}
    map_symbols = np.vectorize(lambda x: m[x])

    def print_board(b):
        print(np.array2string(map_symbols(b), formatter={'str_kind': lambda x: x}))

    print(f"The machine is O. You are X.\nPositions:\n{np.arange(board.size).reshape(board.shape)}")
    while True:
        # Person's turn.
        print_board(board)
        while True:
            pos = input("Where would you like to go?")
            pos = _map_pos(tic_tac_toe, board, int(pos.strip()))
            if board[pos] == 0:
                board[pos] = -1
                break
            else:
                print("There is already a value there.")

        winner = tic_tac_toe.get_winner(board)
        if winner is not None:
            print("You WIN!")
            break

        # Machine's turn.
        original_pos = classifier.predict(board.flatten())
        pos = _map_pos(tic_tac_toe, board, original_pos)
        if board[pos] != 0:
            print(f"Machine picked a spot that already has a marker ({original_pos}). This probably means a draw.")
            print_board(board)
            break
        board[pos] = 1

        winner = tic_tac_toe.get_winner(board)
        if winner is not None:
            print("You lose :(")
            break
    print_board(board)


def evaluate_on_self(classifier, tic_tac_toe):
    print("Evaluating by playing against itself.")

    def _run_game(board, next_player):
        if next_player == -1:
            # Flip the board since the bot always thinks it is 1.
            board_for_prediction = -board
        else:
            board_for_prediction = board
        pos = classifier.predict(board_for_prediction.flatten())
        board[_map_pos(tic_tac_toe, board, pos)] = next_player
        if tic_tac_toe.get_winner(board):
            return next_player
        else:
            return _run_game(board, -1 if next_player == 1 else 1)

    # Start with empty board and let the model pick where to start.
    board = np.zeros((tic_tac_toe.width, tic_tac_toe.length), dtype=np.int8)
    winner = _run_game(board, 1)
    if winner == 1:
        print(f"When model starts: WINS")
    else:
        print(f"When model starts: LOSES")

    winners = Counter()
    for start_pos in range(board.size):
        board = np.zeros((tic_tac_toe.width, tic_tac_toe.length), dtype=np.int8)
        board[_map_pos(tic_tac_toe, board, start_pos)] = -1
        winner = _run_game(board, 1)
        winners[winner] += 1
    print("Winners when -1 starts in each position:")
    print(json.dumps(winners, indent=2))


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
    ttt._train_split = 1
    (x_train, y_train), (x_test, y_test) = ttt.load_data()
    c = inj.get(Classifier)
    c.init_model(x_train, y_train)
    score = c.evaluate(x_train, y_train)
    print(f"Evaluation on training data: {score}")
    if len(x_test) > 0:
        score = c.evaluate(x_test, y_test)
        print(f"Evaluation on test data: {score}")

    evaluate_on_self(c, ttt)

    play_game(c, ttt)
