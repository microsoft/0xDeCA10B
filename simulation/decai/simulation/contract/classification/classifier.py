from abc import ABC, abstractmethod

from decai.simulation.contract.objects import SmartContract


class Classifier(ABC, SmartContract):
    """
    A classifier that can take a data sample as input and return a predict classification/label for the data.
    """

    @abstractmethod
    def evaluate(self, data, labels) -> float:
        """
        Evaluate the model.

        :param data: The data.
        :param labels: The ground truth labels for `data`.
        :return: The accuracy for the given test set.
        """
        pass

    @abstractmethod
    def init_model(self, training_data, labels):
        """
        Fit the model to a specific dataset.

        :param training_data:  The data to use to train the model.
        :param labels: The ground truth labels for `data`.
        """
        pass

    @abstractmethod
    def predict(self, data):
        """

        :param data: The data or features.
        :return: The predicted classification or label for `data`.
        """
        pass

    @abstractmethod
    def update(self, data, classification):
        """
        Update the classifier with one data sample.

        :param data: The training data or features.
        :param classification: The label for `data`.
        """
        pass
