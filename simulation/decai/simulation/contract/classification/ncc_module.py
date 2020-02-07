from decai.simulation.contract.classification.ncc import NearestCentroidClassifier
from decai.simulation.contract.classification.scikit_classifier import SciKitClassifierModule


class NearestCentroidClassifierModule(SciKitClassifierModule):
    def __init__(self):
        super().__init__(
            _model_initializer=NearestCentroidClassifier)
