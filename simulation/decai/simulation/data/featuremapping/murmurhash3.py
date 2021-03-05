import mmh3


class MurmurHash3:
    def hash(text: str):
        # Made to be equivalent to the JavaScript demo code.
        return mmh3.hash(text, signed=False)
