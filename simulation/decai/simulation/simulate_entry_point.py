import os
import sys

from injector import Injector
from sklearn.naive_bayes import MultinomialNB

from decai.simulation.contract.classification.ncc import NearestCentroidClassifierModule
from decai.simulation.contract.classification.perceptron import PerceptronModule
from decai.simulation.contract.classification.scikit_classifier import SciKitClassifierModule
from decai.simulation.contract.collab_trainer import DefaultCollaborativeTrainerModule
from decai.simulation.contract.incentive.stakeable import StakeableImModule
from decai.simulation.data.fitness_data_loader import FitnessDataModule
from decai.simulation.data.imdb_data_loader import ImdbDataModule
from decai.simulation.data.news_data_loader import NewsDataModule
from decai.simulation.logging_module import LoggingModule
from decai.simulation.simulate import Agent, Simulator

# For `bokeh serve`.
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))


def main():
    # This file is set up to use different models and datasets.
    model_type = 'ncc'
    dataset = 'fitness'

    models = dict(
        perceptron=dict(module=PerceptronModule,
                        baseline_accuracy=dict(
                            # train_size, test_size = None, None
                            imdb=0.73,
                            # train_size, test_size = 3500, 1500
                            fitness=0.9507,
                            # train_size, test_size = None, None
                            news=0.9173,
                        )),
        nb=dict(module=SciKitClassifierModule(MultinomialNB),
                baseline_accuracy=dict(
                    # train_size, test_size = None, None
                    imdb=0.8323,
                    # train_size, test_size = 3500, 1500
                    fitness=0.97,
                    # train_size, test_size = None, None
                    news=0.8615,
                )),
        ncc=dict(module=NearestCentroidClassifierModule,
                 baseline_accuracy=dict(
                     # train_size, test_size = None, None
                     imdb=0.7445,
                     # train_size, test_size = 3500, 1500
                     fitness=0.9513,
                     # train_size, test_size = None, None
                     news=0.8324,
                 )),
    )

    datasets = dict(
        fitness=dict(module=FitnessDataModule,
                     train_size=3500, test_size=1500,
                     ),
        news=dict(module=NewsDataModule,
                  train_size=None, test_size=None,
                  ),
        imdb=dict(module=ImdbDataModule(num_words=1000),
                  train_size=None, test_size=None,
                  )
    )

    train_size = datasets[dataset]['train_size']
    test_size = datasets[dataset]['test_size']
    if train_size is None:
        init_train_data_portion = 0.08
    else:
        init_train_data_portion = 100 / train_size

    # Set up the agents that will act in the simulation.
    agents = [
        # Good
        Agent(address="Good",
              start_balance=10_000,
              mean_deposit=50,
              stdev_deposit=10,
              mean_update_wait_s=10 * 60,
              prob_mistake=0.0001,
              ),
        # Malicious: A determined agent with the goal of disrupting others.
        Agent(address="Bad",
              start_balance=10_000,
              mean_deposit=100,
              stdev_deposit=3,
              mean_update_wait_s=1 * 60 * 60,
              good=False,
              ),
        # One that just calls the model and pays to use the model.
        Agent(address="Caller",
              start_balance=30_000,
              mean_deposit=0,
              stdev_deposit=0,
              mean_update_wait_s=2 * 60 * 60,
              calls_model=True,
              pay_to_call=50
              ),
    ]
    # No caller (assume free to call).
    agents = agents[:-1]

    # Set up the data, model, and incentive mechanism.
    inj = Injector([
        DefaultCollaborativeTrainerModule,
        datasets[dataset]['module'],
        LoggingModule,
        models[model_type]['module'],
        StakeableImModule,
    ])
    s = inj.get(Simulator)

    # Start the simulation.
    s.simulate(agents,
               baseline_accuracy=models[model_type]['baseline_accuracy'].get(dataset),
               init_train_data_portion=init_train_data_portion,
               train_size=train_size,
               test_size=test_size,
               )


# Run with `bokeh serve PATH`.
if __name__.startswith('bk_script_'):
    main()
