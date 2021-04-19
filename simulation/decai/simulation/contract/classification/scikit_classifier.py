import json
import logging
import os
import time
from dataclasses import dataclass
from logging import Logger
from pathlib import Path
from typing import Any, Callable, List

import joblib
import numpy as np
import scipy.sparse
from injector import ClassAssistedBuilder, Module, inject, provider
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.naive_bayes import MultinomialNB

from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.classification.ncc import NearestCentroidClassifier
# Purposely not a singleton so that it is easy to get a model that has not been initialized.
from decai.simulation.data.featuremapping.feature_index_mapper import FeatureIndexMapping


@inject
@dataclass
class SciKitClassifier(Classifier):
    """
    Classifier for a scikit-learn like model.
    """

    _logger: Logger
    _model_initializer: Callable[[], Any]

    _model = None

    def __post_init__(self):
        self._original_model_path = Path('saved_models') / f'{time.time()}-{id(self)}.joblib'

    def evaluate(self, data, labels) -> float:
        assert self._model is not None, "The model has not been initialized yet."
        assert isinstance(data, np.ndarray) or scipy.sparse.isspmatrix(data), \
            f"The data must be a matrix. Got: {type(data)}"
        assert isinstance(labels, np.ndarray), "The labels must be an array."
        self._logger.debug("Evaluating.")
        return self._model.score(data, labels)

    def log_evaluation_details(self, data, labels, level=logging.INFO) -> float:
        assert self._model is not None, "The model has not been initialized yet."
        assert isinstance(data, np.ndarray), "The data must be an array."
        assert isinstance(labels, np.ndarray), "The labels must be an array."
        self._logger.debug("Evaluating.")
        predicted_labels = self._model.predict(data)
        result = accuracy_score(labels, predicted_labels)
        if self._logger.isEnabledFor(level):
            m = confusion_matrix(labels, predicted_labels)
            report = classification_report(labels, predicted_labels)
            self._logger.log(level,
                             "Confusion matrix:\n%s"
                             "\nReport:\n%s"
                             "\nAccuracy: %0.2f%%",
                             m, report, result * 100)
        return result

    def init_model(self, training_data, labels, save_model=False):
        assert self._model is None, "The model has already been initialized."
        self._logger.debug("Initializing model.")
        self._model = self._model_initializer()
        self._logger.debug("training_data.shape: %s. dtype: %s", training_data.shape, training_data.dtype)
        self._model.fit(training_data, labels)
        if save_model:
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
        assert self._original_model_path.exists(), "The model has not been saved. Perhaps saving was disabled."
        self._logger.debug("Loading model from \"%s\".", self._original_model_path)
        self._model = joblib.load(self._original_model_path)

    def export(self,
               path: str,
               classifications: List[str] = None,
               model_type: str = None,
               feature_index_mapping: FeatureIndexMapping = None):
        assert self._model is not None, "The model has not been initialized yet."
        assert feature_index_mapping is None, "TODO"
        if isinstance(self._model, SGDClassifier) and self._model.loss == 'perceptron':
            if classifications is None:
                classifications = ["0", "1"]
            model = {
                'type': model_type or 'sparse perceptron',
                'classifications': classifications,
                'weights': self._model.coef_[0].tolist(),
                'intercept': self._model.intercept_[0],
            }
        elif isinstance(self._model, MultinomialNB):
            if classifications is None:
                classifications = list(map(str, range(self._model.feature_count_.shape[1])))
            feature_counts = []
            for class_features in self._model.feature_count_:
                class_feature_counts = []
                for index, count in enumerate(class_features):
                    if count != 0:
                        # Counts should already be integers.
                        class_feature_counts.append((index, int(count)))
                feature_counts.append(class_feature_counts)
            model = {
                'type': model_type or 'naive bayes',
                'classifications': classifications,
                'classCounts': self._model.class_count_.astype(dtype=np.int64).tolist(),
                'featureCounts': feature_counts,
                'totalNumFeatures': self._model.feature_count_.shape[1],
                'smoothingFactor': self._model.alpha,
            }
        elif isinstance(self._model, NearestCentroidClassifier):
            centroids = dict()
            if classifications is None:
                list(map(str, range(len(self.centroids_))))
            for i, classification in enumerate(classifications):
                centroids[classification] = dict(centroid=self._model.centroids_[i].tolist(),
                                                 dataCount=self._model._num_samples_per_centroid[i])
            model = {
                'type': model_type or 'nearest centroid classifier',
                'centroids': centroids,
            }
        else:
            raise Exception("Unrecognized model type.")
        with open(path, 'w') as f:
            json.dump(model, f, separators=(',', ':'))


@dataclass
class SciKitClassifierModule(Module):
    """
    Module to provide SciKit Learn Classifier like models.
    """

    _model_initializer: Any

    # Purposely not a singleton so that it is easy to get a model that has not been initialized.
    @provider
    def provide_classifier(self, builder: ClassAssistedBuilder[SciKitClassifier]) -> Classifier:
        return builder.build(
            _model_initializer=self._model_initializer,
        )
