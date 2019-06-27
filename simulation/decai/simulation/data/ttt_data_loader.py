from dataclasses import dataclass, field
from logging import Logger

import numpy as np
from injector import ClassAssistedBuilder, inject, Module, provider, singleton
from sklearn.utils import shuffle

from .data_loader import DataLoader


@inject
@dataclass
class TicTacToeDataLoader(DataLoader):
    """
    Load data from IMDB reviews.
    """

    _logger: Logger
    _seed: int = field(default=2)
    _train_split: float = field(default=0.7)

    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
        X, y = [], []
        width = length = 3
        assert width == length, "The following code assumes that the board is square."

        def get_single_winner(line: set):
            if len(line) == 1:
                val = next(iter(line))
                if val != 0:
                    return val
            return None

        def get_winner(board):
            for row in range(width):
                result = get_single_winner(set(board[row]))
                if result is not None:
                    return result
            for col in range(length):
                result = get_single_winner(set(board[:, col]))
                if result is not None:
                    return result
            result = get_single_winner(set(board.diagonal()))
            if result is not None:
                return result
            diag_vals = set()
            for i in range(width):
                diag_vals.add(board[i, length - 1 - i])
            result = get_single_winner(diag_vals)
            if result is not None:
                return result

        def fill(board, start_pos, next_player, path):
            for pos in range(start_pos, width * length):
                i, j = pos // width, pos % width
                path.append((board.copy(), pos, next_player))
                board[i, j] = next_player
                winner = get_winner(board)
                if winner is not None:
                    assert winner == next_player
                    for history_board, history_position, history_player in path:
                        if history_player == winner:
                            X.append(history_board)
                            y.append(history_position)
                else:
                    path = list(path)
                    fill(board, start_pos + 1, 2 if next_player == 1 else 1, path)
                board[i, j] = 0

        self._logger.info("Loading Tic Tac Toe data.")

        for init_pos in range(width * length):
            i, j = init_pos // width, init_pos % width

            for player in (1, 2):
                board = np.zeros((width, length), dtype=np.int8)
                path = [(board.copy(), init_pos, player)]
                board[i, j] = player
                fill(board, init_pos + 1, next_player=2 if player == 1 else 1, path=path)

            # Reset
            board[i, j] = 0

        X, y = shuffle(X, y, random_state=self._seed)
        split = int(self._train_split * len(X))
        x_train, y_train = X[split:], y[split:]
        x_test, y_test = X[:split], y[:split]

        self._logger.info("Done loading data.\nCreated %d boards.", len(X))
        return (x_train, y_train), (x_test, y_test)


@dataclass
class TicTacToeDataModule(Module):

    @provider
    @singleton
    def provide_data_loader(self, builder: ClassAssistedBuilder[TicTacToeDataLoader]) -> DataLoader:
        return builder.build()
