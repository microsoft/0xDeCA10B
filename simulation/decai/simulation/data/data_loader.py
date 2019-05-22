from abc import ABC, abstractmethod


class DataLoader(ABC):
    """
    Base class for providing simulation data.
    """

    @abstractmethod
    def load_data(self) -> (tuple, tuple):
        """
        :return: Training Data, Test Data
        """
        pass
