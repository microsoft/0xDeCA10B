from abc import ABC, abstractmethod


class HashMapper(ABC):
    @abstractmethod
    def hash(text: str) -> int:
        raise NotImplementedError
