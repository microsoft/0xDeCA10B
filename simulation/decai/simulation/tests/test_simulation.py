import unittest
from queue import PriorityQueue

from decai.simulation.simulate import Agent


class TestAgent(unittest.TestCase):
    def test_queue(self):
        q = PriorityQueue()
        agents = [
            Agent('a1', 10, 1, 1, 1),
            Agent('a2', 10, 1, 1, 1),
            Agent('a0', 10, 1, 1, 1),
        ]
        [q.put((0, a)) for a in agents]
        results = [q.get()[1].address for _ in agents]
        self.assertEqual(['a0', 'a1', 'a2'], results)
