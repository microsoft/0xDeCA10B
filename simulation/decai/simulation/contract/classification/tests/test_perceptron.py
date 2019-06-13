import random
import unittest

import numpy as np
from injector import Injector

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.classification.classifier import Classifier
from decai.simulation.contract.classification.perceptron import PerceptronClassifier, PerceptronModule
from decai.simulation.contract.collab_trainer import CollaborativeTrainer, DefaultCollaborativeTrainerModule
from decai.simulation.contract.incentive.stakeable import StakeableImModule
from decai.simulation.contract.objects import Msg, RejectException, TimeMock
from decai.simulation.logging_module import LoggingModule


def _ground_truth(data):
    return data[0] * data[2]


class TestCollaborativeTrainer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        inj = Injector([
            DefaultCollaborativeTrainerModule,
            LoggingModule,
            PerceptronModule,
            StakeableImModule,
        ])
        cls.balances = inj.get(Balances)
        cls.decai = inj.get(CollaborativeTrainer)
        cls.time_method = inj.get(TimeMock)

        cls.good_address = 'sender'
        initial_balance = 1E6
        cls.balances.initialize(cls.good_address, initial_balance)
        msg = Msg(cls.good_address, cls.balances[cls.good_address])

        X = np.array([
            # Initialization Data
            [0, 0, 0],
            [1, 1, 1],

            # Data to Add
            [0, 0, 1],
            [0, 1, 0],
            [0, 1, 1],
            [1, 0, 0],
            [1, 0, 1],
            [1, 1, 0],
        ])
        y = [_ground_truth(x) for x in X]
        cls.decai.model.init_model([X[0, :], X[1, :]],
                                   [y[0], y[1]])
        score = cls.decai.model.evaluate(X, y)
        assert score != 1, "Model shouldn't fit the data yet."

        # Add all data.
        first_added_time = None
        for i in range(X.shape[0]):
            x = X[i]
            cls.time_method.set_time(cls.time_method() + 1)
            if first_added_time is None:
                first_added_time = cls.time_method()
            cls.decai.add_data(msg, x, y[i])

        for _ in range(1000):
            score = cls.decai.model.evaluate(X, y)
            if score >= 1:
                break
            i = random.randint(0, X.shape[0] - 1)
            x = X[i]
            cls.time_method.set_time(cls.time_method() + 1)
            cls.decai.add_data(msg, x, y[i])
        assert score == 1, "Model didn't fit the data."

        bal = cls.balances[msg.sender]
        assert bal < initial_balance, "Adding data should have a cost."

        # Make sure sender has some good data refunded so that they can report data later.
        cls.time_method.set_time(cls.time_method() + cls.decai.im.refund_time_s + 1)
        cls.decai.refund(msg, X[0], y[0], first_added_time)
        assert cls.balances[msg.sender] > bal, "Refunding should return value."

    def test_predict(self):
        data = [0, 1, 0]
        correct_class = _ground_truth(data)

        prediction = self.decai.model.predict(data)
        self.assertEqual(prediction, correct_class)

    def test_refund(self):
        data = [0, 2, 0]
        correct_class = _ground_truth(data)

        orig_address = "Orig"
        bal = 1E5
        self.balances.initialize(orig_address, bal)
        msg = Msg(orig_address, 1E3)
        self.time_method.set_time(self.time_method() + 1)
        added_time = self.time_method()
        self.decai.add_data(msg, data, correct_class)
        self.assertLess(self.balances[orig_address], bal)

        # Add same data from another address.
        msg = Msg(self.good_address, 1E3)
        self.time_method.set_time(self.time_method() + 1)
        bal = self.balances[self.good_address]
        self.decai.add_data(msg, data, correct_class)
        self.assertLess(self.balances[self.good_address], bal)

        # Original address refunds.
        msg = Msg(orig_address, 1E3)
        bal = self.balances[orig_address]
        self.time_method.set_time(self.time_method() + self.decai.im.refund_time_s + 1)
        self.decai.refund(msg, data, correct_class, added_time)
        self.assertGreater(self.balances[orig_address], bal)

    def test_report(self):
        data = [0, 0, 0]
        correct_class = _ground_truth(data)
        submitted_classification = 1 - correct_class
        # Add bad data.
        malicious_address = 'malicious'
        self.balances.initialize(malicious_address, 1E6)
        bal = self.balances[malicious_address]
        msg = Msg(malicious_address, bal)
        self.time_method.set_time(self.time_method() + 1)
        added_time = self.time_method()
        self.decai.add_data(msg, data, submitted_classification)
        self.assertLess(self.balances[malicious_address], bal,
                        "Adding data should have a cost.")

        self.time_method.set_time(self.time_method() + self.decai.im.refund_time_s + 1)

        # Can't refund.
        msg = Msg(malicious_address, self.balances[malicious_address])
        try:
            self.decai.refund(msg, data, submitted_classification, added_time)
            self.fail("Should have failed.")
        except RejectException as e:
            self.assertEqual("The model doesn't agree with your contribution.", e.args[0])

        bal = self.balances[self.good_address]
        msg = Msg(self.good_address, bal)
        self.decai.report(msg, data, submitted_classification, added_time, malicious_address)
        self.assertGreater(self.balances[self.good_address], bal)

    def test_report_take_all(self):
        data = [0, 0, 0]
        correct_class = _ground_truth(data)
        submitted_classification = 1 - correct_class
        # Add bad data.
        malicious_address = 'malicious_take_backer'
        self.balances.initialize(malicious_address, 1E6)
        bal = self.balances[malicious_address]
        msg = Msg(malicious_address, bal)
        self.time_method.set_time(self.time_method() + 1)
        added_time = self.time_method()
        self.decai.add_data(msg, data, submitted_classification)
        self.assertLess(self.balances[malicious_address], bal,
                        "Adding data should have a cost.")

        self.time_method.set_time(self.time_method() + self.decai.im.any_address_claim_wait_time_s + 1)

        # Can't refund.
        msg = Msg(malicious_address, self.balances[malicious_address])
        try:
            self.decai.refund(msg, data, submitted_classification, added_time)
            self.fail("Should have failed.")
        except RejectException as e:
            self.assertEqual("The model doesn't agree with your contribution.", e.args[0])

        bal = self.balances[malicious_address]
        msg = Msg(malicious_address, bal)
        self.decai.report(msg, data, submitted_classification, added_time, malicious_address)
        self.assertGreater(self.balances[malicious_address], bal)

    def test_reset(self):
        inj = Injector([
            LoggingModule,
            PerceptronModule,
        ])
        m = inj.get(Classifier)
        self.assertIsInstance(m, PerceptronClassifier)
        X = np.array([
            # Initialization Data
            [0, 0, 0],
            [1, 1, 1],
        ])
        y = [_ground_truth(x) for x in X]
        m.init_model(X, y)
        data = [
            [0, 0, 0],
            [0, 0, 1],
            [0, 1, 0],
            [0, 1, 1],
            [1, 0, 0],
            [1, 0, 1],
            [1, 1, 0],
            [1, 1, 1],
        ]
        original_predictions = [m.predict(x) for x in data]
        labels = [_ground_truth(x) for x in data]
        for x, y in zip(data, labels):
            m.update(x, y)
        predictions_after_training = [m.predict(x) for x in data]
        self.assertNotEqual(original_predictions, predictions_after_training)
        m.reset_model()
        new_predictions = [m.predict(x) for x in data]
        self.assertEqual(original_predictions, new_predictions)
