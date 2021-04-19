from typing import List, Optional, Tuple

import numpy as np
from injector import singleton

FeatureIndexMapping = List[int]


@singleton
class FeatureIndexMapper:
    """
    Helps with mapping sparse data matrices to compact dense ones
    since some classifiers don't work well with sparse data:
    * SGDClassifier needs 32-bit integer indices.
    * MultinomialNB trained to make the data dense.

    This is mostly made to work with 2D data.
    """

    def map(self, training_data, testing_data) -> Tuple[np.ndarray, np.ndarray, Optional[FeatureIndexMapping]]:
        if isinstance(training_data, np.ndarray):
            assert isinstance(testing_data, np.ndarray), \
                f"Testing data must also be an ndarray if the training data is an ndarray. Got: {type(testing_data)}."
            return training_data, testing_data, None

        mapping = sorted(set(training_data.nonzero()[-1]))
        feature_index_to_index_mapping = {v: index for (index, v) in enumerate(mapping)}
        # We want: `result_train = training_data[:, mapping].todense()` but this was allocating a large matrix even before calling `todense()`.
        # Also tried making a mapping matrix and multiplying by it but that also allocated memory.
        result_train = np.zeros(training_data.shape[:-1] + (len(mapping),), dtype=training_data.dtype)
        *row_indices, col_indices = training_data.nonzero()
        col_indices = tuple(feature_index_to_index_mapping[i] for i in col_indices)
        result_train[row_indices, col_indices] = 1

        result_test = np.zeros(testing_data.shape[:-1] + (len(mapping),), dtype=testing_data.dtype)
        *row_indices, col_indices = testing_data.nonzero()
        row_indices_mapped = []
        col_indices_mapped = []
        for row_index, col_index in zip(*row_indices, col_indices):
            index = feature_index_to_index_mapping.get(col_index)
            if index is not None:
                row_indices_mapped.append(row_index)
                col_indices_mapped.append(index)
        result_test[row_indices_mapped, col_indices_mapped] = 1
        return result_train, result_test, mapping
