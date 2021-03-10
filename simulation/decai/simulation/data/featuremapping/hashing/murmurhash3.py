import mmh3

from decai.simulation.data.featuremapping.hashing.hashmapper import HashMapper


class MurmurHash3(HashMapper):
    def hash(self, text: str) -> int:
        # Made to be equivalent to the JavaScript demo code.
        return mmh3.hash(text, signed=False)
