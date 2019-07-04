import os
import time
from dataclasses import dataclass
from logging import Logger

import joblib
import numpy as np
from injector import inject, Module
from skmultiflow.trees import HoeffdingTree

from decai.simulation.contract.classification.classifier import Classifier


# Purposely not a singleton so that it is easy to get a model that has not been initialized.
@inject
@dataclass
class DecisionTreeClassifier(Classifier):
    """
    A decision tree to train models.
    """

    _logger: Logger

    def __post_init__(self):
        self._model = None
        self._original_model_path = f'saved_models/{id(self)}-{time.time()}.joblib'

    def evaluate(self, data, labels) -> float:
        assert self._model is not None, "The model has not been initialized yet."
        assert isinstance(data, np.ndarray), "The data must be an array."
        assert isinstance(labels, np.ndarray), "The labels must be an array."
        self._logger.debug("Evaluating.")
        return self._model.score(data, labels)

    def init_model(self, training_data, labels):
        assert self._model is None, "The model has already been initialized."
        self._logger.debug("Initializing model.")
        self._model = HoeffdingTree()
        self._model.fit(training_data, labels)
        self._logger.debug("Saving model to \"%s\".", self._original_model_path)
        os.makedirs(os.path.dirname(self._original_model_path), exist_ok=True)
        joblib.dump(self._model, self._original_model_path)

    def predict(self, data):
        assert self._model is not None, "The model has not been initialized yet."
        assert isinstance(data, np.ndarray), "The data must be an array."
        return self._model.predict([data])[0]

    def update(self, data, classification):
        assert self._model is not None, "The model has not been initialized yet."
        self._model.partial_fit([data], [classification])

    def reset_model(self):
        assert self._model is not None, "The model has not been initialized yet."
        self._logger.debug("Loading model from \"%s\".", self._original_model_path)
        self._model = joblib.load(self._original_model_path)


class DecisionTreeModule(Module):
    def configure(self, binder):
        binder.bind(Classifier, to=DecisionTreeClassifier)
