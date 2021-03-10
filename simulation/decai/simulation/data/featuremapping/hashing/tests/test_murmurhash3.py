import unittest

from decai.simulation.data.featuremapping.hashing.murmurhash3 import MurmurHash3


class TestMurmurHash3(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.h = MurmurHash3()

    def test_classifications(self):
        assert type(self.h.hash("hey")) == int
        assert self.h.hash("hey") == 318325784
