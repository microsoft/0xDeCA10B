from abc import ABC, abstractmethod
from logging import Logger

from injector import Module, inject, singleton

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.data.data_handler import DataHandler
from decai.simulation.contract.incentive.incentive_mechanism import IncentiveMechanism
from decai.simulation.contract.objects import Msg, SmartContract, TimeMock


class CollaborativeTrainer(ABC, SmartContract):
    """
    Base class for the main interface to create simulations of a training model in a smart contract.
    """

    def __init__(self,
                 balances: Balances,
                 data_handler: DataHandler,
                 incentive_mechanism: IncentiveMechanism,
                 logger: Logger,
                 model: Classifier,
                 time_method: TimeMock,
                 ):
        super().__init__()
        self.data_handler = data_handler
        self.im = incentive_mechanism
        self.model = model

        self._balances = balances
        self._logger = logger
        self._time = time_method

    @abstractmethod
    def add_data(self, msg: Msg, data, label):
        """
        Update the model with one data sample.

        :param msg: Standard message to pass to any method of a smart contract.
        :param data: A single sample of training data for the model.
        :param label: The label for `data`.
        """
        pass

    @abstractmethod
    def predict(self, msg: Msg, data):
        """

        :param msg: Standard message to pass to any method of a smart contract.
        :param data:
        :return: The predicted classification/label for `data`.
        """
        pass

    @abstractmethod
    def refund(self, msg: Msg, data, classification, added_time: int):
        """
        Attempt a refund for the deposit given with submitted data.
        Must be called by the address that originally submitted the data.

        :param msg: Standard message to pass to any method of a smart contract.
        :param data: The data for which to attempt a refund.
        :param classification: The label originally submitted with `data`.
        :param added_time :The time when the data was added.
        """
        pass

    @abstractmethod
    def report(self, msg: Msg, data, classification, added_time: int, original_author: str):
        """
        Report bad or old data and attempt to get a reward.

        :param msg: Standard message to pass to any method of a smart contract.
        :param data: The data to report.
        :param classification: The label originally submitted with `data`.
        :param added_time :The time when the data was added.
        :param original_author: The address that originally added the data.
        """
        pass


@singleton
class DefaultCollaborativeTrainer(CollaborativeTrainer):
    """
    Default implementation of the main interface.
    """

    @inject
    def __init__(self,
                 balances: Balances,
                 data_handler: DataHandler,
                 incentive_mechanism: IncentiveMechanism,
                 logger: Logger,
                 model: Classifier,
                 time_method: TimeMock,
                 ):
        kwargs = dict(locals())
        del kwargs['self']
        del kwargs['__class__']
        super().__init__(**kwargs)

        self.data_handler.owner = self.address
        self.im.owner = self.address
        self.model.owner = self.address

    def predict(self, msg: Msg, data):
        self.im.distribute_payment_for_prediction(msg.sender, msg.value)
        return self.model.predict(data)

    # FUNCTIONS FOR HANDLING DATA

    def add_data(self, msg: Msg, data, classification):
        # Consider making sure duplicate data isn't added until it's been claimed.

        cost, update_model = self.im.handle_add_data(msg.sender, msg.value, data, classification)
        self.data_handler.handle_add_data(msg.sender, cost, data, classification)
        if update_model:
            self.model.update(data, classification)

        # In Solidity the message's value gets taken automatically.
        # Here we do this at the end in case something failed while trying to add data.
        self._balances.send(msg.sender, self.address, cost)

    def refund(self, msg: Msg, data, classification, added_time: int):
        (claimable_amount, claimed_by_submitter, stored_data) = \
            self.data_handler.handle_refund(msg.sender, data, classification, added_time)
        prediction = self.model.predict(data)
        refund_amount = self.im.handle_refund(msg.sender, stored_data,
                                              claimable_amount, claimed_by_submitter, prediction)
        self._balances.send(self.address, msg.sender, refund_amount)

        # The Solidity version doesn't need this extra function call because if there is an error earlier,
        # then the changes automatically get reverted.
        self.data_handler.update_claimable_amount(msg.sender, stored_data, refund_amount)

    def report(self, msg: Msg, data, classification, added_time: int, original_author: str):
        claimed_by_reporter, stored_data = \
            self.data_handler.handle_report(msg.sender, data, classification, added_time, original_author)
        prediction = lambda: self.model.predict(data)
        reward_amount = self.im.handle_report(msg.sender, stored_data, claimed_by_reporter, prediction)
        self.data_handler.update_claimable_amount(msg.sender, stored_data, reward_amount)
        self._balances.send(self.address, msg.sender, reward_amount)


class DefaultCollaborativeTrainerModule(Module):
    def configure(self, binder):
        binder.bind(CollaborativeTrainer, to=DefaultCollaborativeTrainer)
