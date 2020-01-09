import os
import sys

import math
from injector import inject, Injector
from sklearn.naive_bayes import MultinomialNB

from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.classification.scikit_classifier import SciKitClassifierModule
from decai.simulation.contract.collab_trainer import DefaultCollaborativeTrainerModule
from decai.simulation.contract.incentive.stakeable import StakeableImModule
from decai.simulation.data.data_loader import DataLoader
from decai.simulation.data.titanic_data_loader import TitanicDataModule
from decai.simulation.logging_module import LoggingModule
from decai.simulation.simulate import Agent, Simulator

# For `bokeh serve`.
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

# FIXME Using MultinomialNB might not work well with the Titanic dataset because it requires discrete features.

class Runner(object):
    @inject
    def __init__(self,
                 data: DataLoader,
                 simulator: Simulator,
                 ):
        self._data = data
        self._s = simulator

    def run(self):
        init_train_data_portion = 0.10

        # Set up the agents that will act in the simulation.
        agents = [
            # Good
            Agent(address="Good",
                  start_balance=1_000,
                  mean_deposit=5,
                  stdev_deposit=1,
                  mean_update_wait_s=10 * 60,
                  ),
            # Malicious: determined  with the goal of disrupting others.
            Agent(address="Bad",
                  start_balance=1_000,
                  mean_deposit=10,
                  stdev_deposit=3,
                  mean_update_wait_s=1 * 60 * 60,
                  good=False,
                  ),
        ]

        # Start the simulation.
        self._s.simulate(agents,
                         baseline_accuracy=0.791,
                         init_train_data_portion=init_train_data_portion,
                         accuracy_plot_wait_s=math.inf,
                         )


# Run with `bokeh serve PATH`.
if __name__.startswith('bk_script_'):
    # Set up the data, model, and incentive mechanism.
    inj = Injector([
        SciKitClassifierModule(MultinomialNB),
        DefaultCollaborativeTrainerModule,
        LoggingModule,
        StakeableImModule,
        TitanicDataModule,
    ])
    inj.get(Runner).run()

if __name__ == '__main__':
    # Play the game.
    inj = Injector([
        SciKitClassifierModule(MultinomialNB),
        DefaultCollaborativeTrainerModule,
        LoggingModule,
        StakeableImModule,
        TitanicDataModule
    ])
    d = inj.get(DataLoader)
    (x_train, y_train), (x_test, y_test) = d.load_data()
    c = inj.get(Classifier)
    c.init_model(x_train, y_train)
    score = c.evaluate(x_train, y_train)

    print(f"Evaluation on training data: {score * 100:0.2f}%")
    if len(x_test) > 0:
        score = c.evaluate(x_test, y_test)
        print(f"Evaluation on test data: {score * 100:0.2f}%")
