from skmultiflow.trees import HAT, RegressionHAT

from decai.simulation.contract.classification.scikit_classifier import SciKitClassifierModule


class DecisionTreeModule(SciKitClassifierModule):
    def __init__(self, regression=False):
        if regression:
            model_initializer = lambda: RegressionHAT(
                # leaf_prediction='mc'
            )
        else:
            model_initializer = lambda: HAT(
                # leaf_prediction='mc',
                # nominal_attributes=[ 4],
            )
        super().__init__(_model_initializer=model_initializer)
