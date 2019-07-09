from skmultiflow.trees import HAT, RegressionHAT

from decai.simulation.contract.classification.scikit_classifier import SciKitClassifierModule


class DecisionTreeModule(SciKitClassifierModule):
    def __init__(self, regression=False):
        if regression:
            model = self._model = RegressionHAT(
                # leaf_prediction='mc'
            )
        else:
            model = HAT(
                # leaf_prediction='mc',
                # nominal_attributes=[ 4],
            )
        super().__init__(_model=model)
