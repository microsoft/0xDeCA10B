import json
import logging
import os
import random
import time
from dataclasses import asdict, dataclass
from functools import partial
from logging import Logger
from queue import PriorityQueue
from threading import Thread
from typing import List

from bokeh.document import Document
from bokeh.io import export_png
from bokeh.models import AdaptiveTicker, ColumnDataSource, FuncTickFormatter, PrintfTickFormatter
from bokeh.plotting import curdoc, figure
from injector import inject
from tornado import gen
from tqdm import tqdm

from decai.simulation.contract.balances import Balances
from decai.simulation.contract.collab_trainer import CollaborativeTrainer
from decai.simulation.contract.objects import Msg, RejectException, TimeMock
from decai.simulation.data.data_loader import DataLoader


@dataclass
class Agent:
    """
    A user to run in the simulator.
    """
    address: str
    start_balance: float
    mean_deposit: float
    stdev_deposit: float
    mean_update_wait_s: float
    stdev_update_wait_time: float = 1
    pay_to_call: float = 0
    good: bool = True
    prob_mistake: float = 0
    calls_model: bool = False

    def __post_init__(self):
        assert self.start_balance > self.mean_deposit

    def __lt__(self, other):
        return self.address < other.address

    def get_next_deposit(self) -> int:
        while True:
            result = int(random.normalvariate(self.mean_deposit, self.stdev_deposit))
            if result > 0:
                return result

    def get_next_wait_s(self) -> int:
        while True:
            result = int(random.normalvariate(self.mean_update_wait_s, self.stdev_update_wait_time))
            if result >= 1:
                return result


class Simulator(object):
    """
    A simulator for Decentralized & Collaborative AI.
    """

    @inject
    def __init__(self,
                 balances: Balances,
                 data_loader: DataLoader,
                 decai: CollaborativeTrainer,
                 logger: Logger,
                 time_method: TimeMock,
                 ):

        self._balances = balances
        self._data_loader = data_loader
        self._decai = decai
        self._logger = logger
        self._time = time_method

    def simulate(self,
                 agents: List[Agent],
                 baseline_accuracy: float = None,
                 init_train_data_portion: float = 0.1,
                 ):
        """
        Run a simulation.

        :param agents: The agents that will interact with the data.
        :param baseline_accuracy: The baseline accuracy of the model.
            Usually the accuracy on a hidden test set when the model is trained with all data.
        :param init_train_data_portion: The portion of the data to initially use for training. Must be [0,1].
        """

        assert 0 <= init_train_data_portion <= 1

        # Data to save.
        save_data = dict(agents=[asdict(a) for a in agents],
                         baselineAccuracy=baseline_accuracy,
                         initTrainDataPortion=init_train_data_portion,
                         accuracies=[],
                         balances=[],
                         )
        time_for_filenames = int(time.time())
        save_path = f'saved_runs/{time_for_filenames}.json'
        plot_save_path = f'saved_runs/{time_for_filenames}_plot.png'
        self._logger.info("Saving run info to \"%s\".", save_path)
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        # Set up plots.
        doc: Document = curdoc()
        doc.title = "DeCAI Simulation"

        plot = figure(title="Balances & Accuracy on Hidden Test Set",
                      )
        plot.width = 800
        plot.height = 600

        plot.xaxis.axis_label = "Time (days)"
        plot.yaxis.axis_label = "Percent"
        plot.title.text_font_size = '20pt'
        plot.xaxis.major_label_text_font_size = '20pt'
        plot.xaxis.axis_label_text_font_size = '20pt'
        plot.yaxis.major_label_text_font_size = '20pt'
        plot.yaxis.axis_label_text_font_size = '20pt'

        plot.xaxis[0].ticker = AdaptiveTicker(base=5 * 24 * 60 * 60)
        plot.xgrid[0].ticker = AdaptiveTicker(base=24 * 60 * 60)

        balance_plot_sources_per_agent = dict()
        for agent in agents:
            source = ColumnDataSource(dict(t=[], b=[]))
            assert agent.address not in balance_plot_sources_per_agent
            balance_plot_sources_per_agent[agent.address] = source
            if agent.calls_model:
                color = 'blue'
                line_dash = 'dashdot'
            elif agent.good:
                color = 'green'
                line_dash = 'dotted'
            else:
                color = 'red'
                line_dash = 'dashed'
            plot.line(x='t', y='b',
                      line_dash=line_dash,
                      line_width=2,
                      source=source,
                      color=color,
                      legend=f"{agent.address} Agent Balance")

        plot.legend.location = 'top_left'
        plot.legend.label_text_font_size = '12pt'

        plot.xaxis[0].formatter = FuncTickFormatter(code="""
        // JavaScript code
        return (tick / 86400).toFixed(0);
        """)
        plot.yaxis[0].formatter = PrintfTickFormatter(format="%0.1f%%")

        acc_source = ColumnDataSource(dict(t=[], a=[]))
        if baseline_accuracy is not None:
            plot.ray(x=[0], y=[baseline_accuracy * 100], length=0, angle=0, line_width=2,
                     legend=f"Accuracy when trained with all data: {baseline_accuracy * 100:0.1f}%")
        plot.line(x='t', y='a',
                  line_dash='solid',
                  line_width=2,
                  source=acc_source,
                  color='black',
                  legend="Current Accuracy")

        @gen.coroutine
        def plot_cb(agent: Agent, t, b):
            source = balance_plot_sources_per_agent[agent.address]
            source.stream(dict(t=[t], b=[b * 100 / agent.start_balance]))
            save_data['balances'].append(dict(t=t, a=agent.address, b=b))

        @gen.coroutine
        def plot_accuracy_cb(t, a):
            acc_source.stream(dict(t=[t], a=[a * 100]))
            save_data['accuracies'].append(dict(t=t, accuracy=a))

        def task():
            (x_train, y_train), (x_test, y_test) = self._data_loader.load_data()
            init_idx = int(len(x_train) * init_train_data_portion)
            self._logger.info("Initializing model with %d out of %d samples.",
                              init_idx, len(x_train))
            x_init_data, y_init_data = x_train[:init_idx], y_train[:init_idx]
            x_remaining, y_remaining = x_train[init_idx:], y_train[init_idx:]

            self._decai.model.init_model(x_init_data, y_init_data)
            if self._logger.isEnabledFor(logging.DEBUG):
                s = self._decai.model.evaluate(x_init_data, y_init_data)
                self._logger.debug("Initial training data evaluation: %s", s)
                s = self._decai.model.evaluate(x_remaining, y_remaining)
                self._logger.debug("Remaining training data evaluation: %s", s)

            self._logger.info("Evaluating initial model.")
            accuracy = self._decai.model.evaluate(x_test, y_test)
            self._logger.info("Initial test set accuracy: %0.2f%%", accuracy * 100)
            t = self._time()
            doc.add_next_tick_callback(
                partial(plot_accuracy_cb, t=t, a=accuracy))

            q = PriorityQueue()
            random.shuffle(agents)
            for agent in agents:
                self._balances.initialize(agent.address, agent.start_balance)
                q.put((self._time() + agent.get_next_wait_s(), agent))
                doc.add_next_tick_callback(
                    partial(plot_cb, agent=agent, t=t, b=agent.start_balance))

            unclaimed_data = []
            next_data_index = 0
            next_accuracy_plot_time = 1E4
            desc = "Processing agent requests"
            with tqdm(desc=desc,
                      unit_scale=True, mininterval=2, unit=" requests",
                      total=len(x_remaining),
                      ) as pbar:
                while not q.empty():
                    # For now assume sending a transaction (editing) is free (no gas)
                    # since it should be relatively cheaper than the deposit required to add data.
                    # It may not be cheaper than calling `report`.

                    if next_data_index >= len(x_remaining) and len(unclaimed_data) == 0:
                        break

                    current_time, agent = q.get()
                    update_balance_plot = False
                    if current_time > next_accuracy_plot_time:
                        # Might be need to sleep to allow the plot to update.
                        # time.sleep(0.1)
                        self._logger.debug("Evaluating.")
                        next_accuracy_plot_time += 2E5
                        accuracy = self._decai.model.evaluate(x_test, y_test)
                        doc.add_next_tick_callback(
                            partial(plot_accuracy_cb, t=current_time, a=accuracy))

                        self._logger.debug("Unclaimed data: %d", len(unclaimed_data))
                        pbar.set_description(f"{desc} ({len(unclaimed_data)} unclaimed)")

                        with open(save_path, 'w') as f:
                            json.dump(save_data, f, separators=(',', ':'))

                        export_png(plot, plot_save_path)

                    self._time.set_time(current_time)

                    balance = self._balances[agent.address]
                    if balance > 0 and next_data_index < len(x_remaining):
                        # Pick data.
                        x, y = x_remaining[next_data_index], y_remaining[next_data_index]

                        if agent.calls_model:
                            # Only call the model if it's good.
                            if random.random() < accuracy:
                                update_balance_plot = True
                                self._decai.predict(Msg(agent.address, agent.pay_to_call), x)
                        else:
                            if not agent.good:
                                y = 1 - y
                            if agent.prob_mistake > 0 and random.random() < agent.prob_mistake:
                                y = 1 - y

                            # Bad agents always contribute.
                            # Good agents will only work if the model is doing well.
                            # Add a bit of chance they will contribute since 0.85 accuracy is okay.
                            if not agent.good or random.random() < accuracy + 0.15:
                                value = agent.get_next_deposit()
                                if value <= balance:
                                    msg = Msg(agent.address, value)
                                    try:
                                        self._decai.add_data(msg, x, y)
                                        update_balance_plot = True
                                        balance = self._balances[agent.address]
                                        unclaimed_data.append((current_time, agent, x, y))
                                        next_data_index += 1
                                        pbar.update()
                                    except RejectException:
                                        # Probably failed because they didn't pay enough which is okay.
                                        # Or if not enough time has passed since data was attempted to be added
                                        # which is okay too because a real contract would reject this
                                        # because the smallest unit of time we can use is 1s.
                                        if self._logger.isEnabledFor(logging.DEBUG):
                                            self._logger.exception("Error adding data.")

                    if balance > 0:
                        q.put((current_time + agent.get_next_wait_s(), agent))

                    claimed_indices = []
                    for i in range(len(unclaimed_data)):
                        added_time, adding_agent, x, classification = unclaimed_data[i]
                        if current_time - added_time < self._decai.im.refund_time_s:
                            break
                        if next_data_index >= len(x_remaining) \
                                and current_time - added_time < self._decai.im.any_address_claim_wait_time_s:
                            break
                        balance = self._balances[agent.address]
                        msg = Msg(agent.address, balance)

                        if current_time - added_time > self._decai.im.any_address_claim_wait_time_s:
                            # Attempt to take the entire deposit.
                            try:
                                self._decai.report(msg, x, classification, added_time, adding_agent.address)
                                update_balance_plot = True
                            except RejectException:
                                if self._logger.isEnabledFor(logging.DEBUG):
                                    self._logger.exception("Error taking reward.")
                        elif adding_agent.address == agent.address:
                            try:
                                self._decai.refund(msg, x, classification, added_time)
                                update_balance_plot = True
                            except RejectException:
                                if self._logger.isEnabledFor(logging.DEBUG):
                                    self._logger.exception("Error getting refund.")
                        else:
                            try:
                                self._decai.report(msg, x, classification, added_time, adding_agent.address)
                                update_balance_plot = True
                            except RejectException:
                                if self._logger.isEnabledFor(logging.DEBUG):
                                    self._logger.exception("Error taking reward.")

                        stored_data = self._decai.data_handler.get_data(x, classification,
                                                                        added_time, adding_agent.address)
                        if stored_data.claimable_amount <= 0:
                            claimed_indices.append(i)

                    for i in claimed_indices[::-1]:
                        unclaimed_data.pop(i)

                    if update_balance_plot:
                        balance = self._balances[agent.address]
                        doc.add_next_tick_callback(
                            partial(plot_cb, agent=agent, t=current_time, b=balance))

            self._logger.info("Done going through data.")
            pbar.set_description(f"{desc} ({len(unclaimed_data)} unclaimed)")

            with open(save_path, 'w') as f:
                json.dump(save_data, f, separators=(',', ':'))

            export_png(plot, plot_save_path)

        doc.add_root(plot)
        thread = Thread(target=task)
        thread.start()
