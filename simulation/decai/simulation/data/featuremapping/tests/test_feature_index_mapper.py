import unittest

import numpy as np
import scipy.sparse
from injector import Injector

from decai.simulation.data.featuremapping.feature_index_mapper import FeatureIndexMapper
from decai.simulation.logging_module import LoggingModule


class TestFeatureIndexMapper(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        inj = Injector([
            LoggingModule,
        ])

        cls.f = inj.get(FeatureIndexMapper)

    def test_map_dense(self):
        x_train = np.random.random_sample((10, 3))
        x_test = np.random.random_sample((4, x_train.shape[1]))
        train, test, feature_index_mapping = self.f.map(x_train, x_test)
        self.assertIs(train, x_train)
        self.assertIs(test, x_test)
        self.assertIsNone(feature_index_mapping)

    def test_map_sparse(self):
        x_train = np.array([[0, 0, 1, 1, 0], [0, 1, 0, 0, 0]])
        x_test = np.array([[1, 0, 1, 0, 1], [0, 0, 1, 0, 0]])
        x_train_sparse = scipy.sparse.csr_matrix((17348, 4288315073), dtype=np.uint8)
        x_train_sparse[x_train.nonzero()] = 1
        x_test_sparse = scipy.sparse.csr_matrix((3333, 21312344), dtype=np.uint8)
        x_test_sparse[x_test.nonzero()] = 1
        mapped_train, mapped_test, feature_index_mapping = self.f.map(x_train_sparse, x_test_sparse)
        self.assertEqual([1, 2, 3], feature_index_mapping)
        self.assertTrue(mapped_train.sum(axis=0).all(),
                        "Every column should have at least one non-zero value.")
        x_train_expected = np.zeros((x_train_sparse.shape[0], len(feature_index_mapping)), dtype=np.uint8)
        x_train_expected[0, 1] = 1
        x_train_expected[0, 2] = 1
        x_train_expected[1, 0] = 1
        self.assertTrue(np.array_equal(x_train_expected, mapped_train), mapped_train)
        x_test_expected = np.zeros((x_test_sparse.shape[0], len(feature_index_mapping)), dtype=np.uint8)
        x_test_expected[0, 1] = 1
        x_test_expected[1, 1] = 1
        self.assertTrue(np.array_equal(x_test_expected, mapped_test), mapped_test)
