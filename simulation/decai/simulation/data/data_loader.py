from abc import ABC, abstractmethod


class DataLoader(ABC):
    """
    Base class for providing simulation data.
    """

    @abstractmethod
    def load_data(self, train_size: int = None, test_size: int = None) -> (tuple, tuple):
        """
        :return: Training Data, Test Data: (x_train, y_train), (x_test, y_test)
        """
        pass
