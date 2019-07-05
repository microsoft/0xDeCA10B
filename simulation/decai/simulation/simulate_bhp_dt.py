import os
import sys
from typing import cast

import math
from injector import inject, Injector

from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.classification.decision_tree import DecisionTreeModule
from decai.simulation.contract.collab_trainer import DefaultCollaborativeTrainerModule
from decai.simulation.contract.incentive.stakeable import StakeableImModule
from decai.simulation.data.bhp_data_loader import BhpDataModule
from decai.simulation.data.data_loader import DataLoader
from decai.simulation.logging_module import LoggingModule
from decai.simulation.simulate import Agent, Simulator

# For `bokeh serve`.
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))


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
                  start_balance=10_000,
                  mean_deposit=5,
                  stdev_deposit=1,
                  mean_update_wait_s=10 * 60,
                  ),
            # Malicious: determined  with the goal of disrupting others.
            Agent(address="Bad",
                  start_balance=10_000,
                  mean_deposit=10,
                  stdev_deposit=3,
                  mean_update_wait_s=1 * 60 * 60,
                  good=False,
                  ),
        ]

        # Start the simulation.
        self._s.simulate(agents,
                         baseline_accuracy=0.44,
                         init_train_data_portion=init_train_data_portion,
                         accuracy_plot_wait_s=math.inf,
                         )


# Run with `bokeh serve PATH`.
if __name__.startswith('bk_script_'):
    # Set up the data, model, and incentive mechanism.
    inj = Injector([
        DecisionTreeModule,
        DefaultCollaborativeTrainerModule,
        LoggingModule,
        StakeableImModule,
        BhpDataModule,
    ])
    inj.get(Runner).run()

if __name__ == '__main__':
    # Play the game.
    inj = Injector([
        DecisionTreeModule(regression=True),
        DefaultCollaborativeTrainerModule,
        LoggingModule,
        StakeableImModule,
        BhpDataModule,
    ])
    d = inj.get(DataLoader)
    (x_train, y_train), (x_test, y_test) = d.load_data()
    c = inj.get(Classifier)
    c.init_model(x_train, y_train)
    score = c.evaluate(x_train, y_train)
    import random

    for _ in range(10):
        i = random.randrange(len(x_train))
        print(f"{i:04d}: {x_train[i]}: {y_train[i]}")
        print(f"Prediction: {c.predict(x_train[i])}")
    print(f"Evaluation on training data: {score}")
    if len(x_test) > 0:
        score = c.evaluate(x_test, y_test)
        print(f"Evaluation on test data: {score}")
