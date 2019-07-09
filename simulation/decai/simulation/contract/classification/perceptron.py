import os

from sklearn.linear_model import SGDClassifier

from decai.simulation.contract.classification.scikit_classifier import SciKitClassifierModule


class PerceptronModule(SciKitClassifierModule):
    def __init__(self):
        super().__init__(
            _model=SGDClassifier(
                loss='perceptron',
                n_jobs=max(1, os.cpu_count() - 2),
                random_state=0xDeCA10B,
                learning_rate='optimal',
                # Don't really care about tol, just setting it to remove a warning.
                tol=1e-3,
                penalty=None))
