from collections import Counter

from injector import inject
from sklearn.neighbors import NearestCentroid

from decai.simulation.contract.classification.scikit_classifier import SciKitClassifierModule


# Purposely not a singleton so that it is easy to get a model that has not been initialized.
@inject
class NearestCentroidClassifier(NearestCentroid):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._num_samples = 0

    def fit(self, X, y):
        self._num_samples_per_centroid = Counter(y)
        super().fit(X, y)

    def partial_fit(self, training_data, labels):
        # Assume len(training_data) == len(labels) == 1
        # Assume centroids are indexed by class 0-N.
        sample = training_data[0]
        label = labels[0]
        n = self._num_samples_per_centroid[label]
        self.centroids_[label] = (self.centroids_[label] * n + sample) / (n + 1)
        self._num_samples_per_centroid[label] = n + 1




class NearestCentroidClassifierModule(SciKitClassifierModule):
    def __init__(self):
        super().__init__(
            _model_initializer=NearestCentroidClassifier)
