# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles objects
of type `null`.
"""

from schema_fuzzer.generator.context import BaseGenerator, Schema


class NullGenerator(BaseGenerator):
    """
    Generator that handles generation of the `null` type object.

    Object of type `null` is simply a constant that always equals null, by
    itself it's not particularly useful, however schemas often use it in the
    union syntax to create nullable values (see `type_union.py`).

    """

    def generate(self) -> None:
        return None

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        return "type" in schema and schema["type"] == "null"
