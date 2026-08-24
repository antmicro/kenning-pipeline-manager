"""
Module that provides implementation of the BaseGenerator, that handles objects
of type `boolean`.
"""

import random

from schema_fuzzer.generator.context import BaseGenerator, Schema


class BooleanGenerator(BaseGenerator):
    """
    Generator that handles generations of `boolean` type objects.

    Generates either `true` or `false` at random.
    """

    def generate(self) -> bool:
        return random.choice([True, False])

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        return "type" in schema and schema["type"] == "boolean"
