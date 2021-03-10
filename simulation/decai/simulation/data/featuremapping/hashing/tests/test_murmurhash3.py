import unittest

from decai.simulation.data.featuremapping.hashing.murmurhash3 import MurmurHash3


class TestMurmurHash3(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.h = MurmurHash3()

    def test_classifications(self):
        h = self.h.hash("hey")
        assert type(h) == int
        assert h == 318325784
