from typing import Optional, Tuple

import numpy as np


class FeatureMapper:
    """
    Helps with mapping sparse data matrices to compact dense ones
    since some classifiers don't work well with sparse data.
    """
    def map(self, training_data, testing_data) -> Tuple[np.ndarray, np.ndarray, Optional[dict]]:
        if isinstance(training_data, np.ndarray):
            assert isinstance(testing_data, np.ndarray), \
                f"Testing data must also be an ndarray if the training data is an ndarray. Got: {type(testing_data)}."
            return training_data, testing_data, None
        # TODO Map the data.
        raise NotImplementedError
