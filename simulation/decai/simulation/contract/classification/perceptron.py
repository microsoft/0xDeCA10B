import os

from injector import Module
from sklearn.linear_model import SGDClassifier

from decai.simulation.contract.classification.classifier import Classifier


# Purposely not a singleton so that it is easy to get a model that has not been initialized.
class PerceptronClassifier(Classifier):
    """
    A Perceptron model to train models.
    """

    def evaluate(self, data, labels) -> float:
        return self._model.score(data, labels)

    def init_model(self, training_data, labels):
        self._model = SGDClassifier(loss='perceptron',
                                    n_jobs=max(1, os.cpu_count() - 2),
                                    random_state=0xDeCA10B,
                                    learning_rate='optimal',
                                    # Don't really care about tol, just setting it to remove a warning.
                                    tol=1e-3,
                                    penalty=None)
        self._model.fit(training_data, labels)

    def predict(self, data):
        return self._model.predict([data])[0]

    def update(self, data, classification):
        self._model.partial_fit([data], [classification])


class PerceptronModule(Module):
    def configure(self, binder):
        binder.bind(Classifier, to=PerceptronClassifier)
