import json
from collections import defaultdict
from dataclasses import dataclass
from itertools import cycle
from logging import Logger
from operator import itemgetter
from pathlib import Path
from typing import List, Dict

from bokeh import colors
from bokeh.io import export_png
from bokeh.plotting import figure, output_file, show
from injector import Injector, inject

from decai.simulation.logging_module import LoggingModule
from decai.simulation.simulate import Agent


@inject
@dataclass
class SimulationCombiner(object):
    _logger: Logger

    def combine(self, runs: List[Dict], img_save_path: str):
        """
        Combine runs from several files.

        :param paths: The paths to the runs to combine.
        """
        output_file('plots.html')
        plot = figure(title="Balances & Accuracy on Hidden Test Set", )

        # TODO Make plot wider (or maybe it's ok for the paper).

        # TODO Put legend above.

        good_colors = cycle([
            colors.named.green,
            colors.named.lawngreen,
            colors.named.darkgreen,
            colors.named.limegreen,
        ])
        bad_colors = cycle([
            colors.named.red,
            colors.named.darkred,
            colors.named.orangered,
            colors.named.indianred,
        ])
        accuracy_colors = cycle([
            colors.named.blue,
            colors.named.cadetblue,
            colors.named.cornflowerblue,
            colors.named.darkblue,
        ])
        baseline_accuracy_colors = cycle([
            colors.named.black,
            colors.named.darkgrey,
            colors.named.slategrey,
            colors.named.darkslategrey,
        ])
        line_dashes = cycle([
            'solid',
            'dashed',
            'dotted',
            'dotdash',
            'dashdot',
        ])

        for run in runs:
            name = run['name']
            path = run['path']
            line_dash = next(line_dashes)
            self._logger.info("Opening \"%s\".", path)
            with open(path) as f:
                data = json.load(f)
                baseline_accuracy = data['baselineAccuracy']
                if baseline_accuracy is not None:
                    self._logger.debug("Baseline accuracy: %s", baseline_accuracy)
                    plot.ray(x=[0], y=[baseline_accuracy * 100], length=0, angle=0, line_width=2,
                             line_dash=line_dash,
                             color=next(baseline_accuracy_colors),
                             legend=f"{name} accuracy when trained with all data: {baseline_accuracy * 100:0.1f}%")
                agents: Dict[str, Agent] = dict()
                for agent in data['agents']:
                    agent = Agent(**agent)
                    agents[agent.address] = agent
                plot.line(x=[d['t'] for d in data['accuracies']],
                          y=[d['accuracy'] * 100 for d in data['accuracies']],
                          line_dash=line_dash,
                          line_width=2,
                          color=next(accuracy_colors),
                          legend=f"{name} Accuracy"
                          )
                agent_balance_data = defaultdict(list)
                for balance_data in data['balances']:
                    agent = balance_data['a']
                    agent_balance_data[agent].append(
                        (balance_data['t'], balance_data['b'] * 100 / agents[agent].start_balance))
                for agent_id, balance_data in agent_balance_data.items():
                    agent = agents[agent_id]
                    if agent.good:
                        color = next(good_colors)
                    else:
                        color = next(bad_colors)
                    plot.line(x=list(map(itemgetter(0), balance_data)),
                              y=list(map(itemgetter(1), balance_data)),
                              line_dash=line_dash,
                              line_width=2,
                              color=color,
                              legend=f"{name} {agent.address} Balance"
                              )
        self._logger.info("Done going through runs.")
        export_png(plot, img_save_path)
        show(plot)


if __name__ == '__main__':
    inj = Injector([
        LoggingModule,
    ])
    s = inj.get(SimulationCombiner)
    path = Path(__file__, '../../..').resolve()
    s.combine([
        dict(name="NB",
             path=path / 'saved_runs/1578937397-fitness-nb.json',
             ),
        dict(name="Perceptron",
             path=path / 'saved_runs/1578934493-fitness-perceptron.json',
             ),
        dict(name="NCC",
             path=path / 'saved_runs/1578938741-fitness-ncc.json',
             ),
    ],
        path / 'saved_runs/fitness.png')
