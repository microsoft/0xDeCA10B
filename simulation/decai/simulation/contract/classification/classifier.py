import logging
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

        :param data: Data samples.
        :param labels: The ground truth labels for `data`.
        :return: The accuracy for the given test set.
        """
        pass

    @abstractmethod
    def log_evaluation_details(self, data, labels, level=logging.INFO) -> float:
        """
        Log some evaluation details.

        :param data: Data samples.
        :param labels: The ground truth labels for `data`.
        :param level: The level at which to log.
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

        :param data: The data or features for one sample.
        :return: The predicted classification or label for `data`.
        """
        pass

    @abstractmethod
    def update(self, data, classification):
        """
        Update the classifier with one data sample.

        :param data: The training data or features for one sample.
        :param classification: The label for `data`.
        """
        pass

    @abstractmethod
    def reset_model(self):
        """
        Re-initialize the model to the same state it was in after `init_model` was called.
        """
        pass