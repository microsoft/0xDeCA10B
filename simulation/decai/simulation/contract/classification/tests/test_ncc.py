import unittest

import numpy as np
from injector import Injector

from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.classification.ncc import NearestCentroidClassifierModule
from decai.simulation.logging_module import LoggingModule


def _ground_truth(data):
    return data[0] * data[2]


class TestNearestCentroidClassifier(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inj = Injector([
            LoggingModule,
            NearestCentroidClassifierModule,
        ])

    def test_partial_fit(self):
        model = self.inj.get(Classifier)
        data = [
            [-1.0, -1.0, ],
            [-0.5, -0.5, ],

            [+1.0, +1.0],
            [+0.5, +0.5],
        ]
        labels = [0, 0, 1, 1, ]
        data = np.array(data)
        labels = np.array(labels)
        model.init_model(data, labels)

        self.assertEqual(1, model.evaluate(data, labels))

        sample = np.array([0.1, 0.1, ])
        self.assertEqual(1, model.predict(sample))

        # Update a point beyond `sample` so that `sample` get a new label.
        model.update(np.array([0.3, 0.3, ]), 0)
        self.assertEqual(0, model.predict(sample))

        self.assertEqual(1, model.evaluate(data, labels))

    def test_partial_fit_2(self):
        model = self.inj.get(Classifier)
        data = [
            [0, -1.0, ],
            [0, -0.5, ],

            [0, +1.0],
            [0, +0.5],
        ]
        labels = [0, 0, 1, 1, ]
        data = np.array(data)
        labels = np.array(labels)
        model.init_model(data, labels)

        self.assertEqual(1, model.evaluate(data, labels))

        sample = np.array([0, +0.1, ])
        self.assertEqual(1, model.predict(sample))

        # Update a point beyond `sample` so that `sample` get a new label.
        model.update(np.array([0, -0.3, ]), 0)
        self.assertEqual(0, model.predict(sample))

        self.assertEqual(1, model.evaluate(data, labels))
