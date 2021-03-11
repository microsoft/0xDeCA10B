from abc import ABC, abstractmethod


class TokenHash(ABC):
    """
    Hashes token to unsigned integers.
    Useful for sparse representation.
    """

    @abstractmethod
    def hash(self, text: str) -> int:
        raise NotImplementedError
