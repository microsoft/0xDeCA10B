from dataclasses import dataclass, field
from logging import Logger

import numpy as np
from injector import inject, Module
from sklearn.utils import shuffle
from tqdm import trange

from .data_loader import DataLoader


@inject
@dataclass
class TicTacToeDataLoader(DataLoader):
    """
    Load data for Tic-Tac-Toe games.

    Data is flattened `width` x `length` games.
    The players are 1 and -1. The data is from the perspective of player 1, opponent is -1.
    0 means no one has played in that position.
    """

    _logger: Logger
    _seed: int = field(default=2, init=False)
    _train_split: float = field(default=0.7, init=False)

    width: int = field(default=3, init=False)
    length: int = field(default=3, init=False)

    def get_winner(self, board):
        def get_single_winner(line: set):
            if len(line) == 1:
                val = next(iter(line))
                if val != 0:
                    return val
            return None

        for row in range(self.width):
            result = get_single_winner(set(board[row]))
            if result is not None:
                return result
        for col in range(self.length):
            result = get_single_winner(set(board[:, col]))
            if result is not None:
                return result
        result = get_single_winner(set(board.diagonal()))
        if result is not None:
            return result
        diag_vals = set(board[i, self.length - 1 - i] for i in range(self.width))
        result = get_single_winner(diag_vals)
        if result is not None:
            return result
        return None

    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
        X, y = [], []

        players = (1, -1)
        assert self.width == self.length, "The following code assumes that the board is square."

        def fill(board, start_pos, next_player, path):
            # See if there is a winning move.
            winner = None
            for pos in range(start_pos, self.width * self.length):
                i, j = pos // self.width, pos % self.width
                if board[i, j] != 0:
                    continue
                _board = board.copy()
                _board[i, j] = next_player
                winner = self.get_winner(_board)
                if winner is not None:
                    path.append((board, pos, next_player))
                    break

            if winner is not None:
                # Only count wins for one of the players to make setting up games simpler.
                if winner == players[0]:
                    for history_board, history_position, history_player in path:
                        if history_player == winner:
                            X.append(history_board)
                            y.append(history_position)
            else:
                # Recurse.
                for pos in range(start_pos, self.width * self.length):
                    i, j = pos // self.width, pos % self.width
                    if board[i, j] != 0:
                        continue
                    _path = list(path)
                    _path.append((board, pos, next_player))
                    _board = board.copy()
                    _board[i, j] = next_player
                    fill(_board, start_pos, next_player=-1 if next_player == 1 else 1, path=_path)

        self._logger.info("Loading Tic Tac Toe data.")

        for init_pos in trange(self.width * self.length,
                               desc="Making boards",
                               unit_scale=True, mininterval=2, unit=" start positions"
                               ):
            i, j = init_pos // self.width, init_pos % self.width

            for player in players:
                board = np.zeros((self.width, self.length), dtype=np.int8)
                path = [(board.copy(), init_pos, player)]
                board[i, j] = player
                fill(board, init_pos + 1, next_player=-1 if player == 1 else 1, path=path)

        X, y = shuffle(X, y, random_state=self._seed)
        X = [x.flatten() for x in X]
        split = int(self._train_split * len(X))
        x_train, y_train = np.array(X[:split]), np.array(y[:split])
        x_test, y_test = np.array(X[split:]), np.array(y[split:])

        # Show some data.
        # import random
        # for _ in range(10):
        #     i = random.randrange(len(X))
        #     print(X[i].reshape((self.width, self.length)), y[i])

        self._logger.info("Done loading data.\nCreated %d boards.", len(X))
        return (x_train, y_train), (x_test, y_test)


class TicTacToeDataModule(Module):
    def configure(self, binder):
        binder.bind(DataLoader, TicTacToeDataLoader)
