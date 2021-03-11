import mmh3
from injector import Module

from decai.simulation.data.featuremapping.hashing.token_hash import TokenHash


class MurmurHash3(TokenHash):
    def hash(self, text: str) -> int:
        # Made to be equivalent to the JavaScript demo code.
        return mmh3.hash(text, signed=False)


class MurmurHash3Module(Module):
    def configure(self, binder):
        binder.bind(TokenHash, to=MurmurHash3)
