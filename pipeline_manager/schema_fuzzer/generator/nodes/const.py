# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles the
`const` syntax.
"""

from typing import Any

from pipeline_manager.schema_fuzzer.generator.context import (
    BaseGenerator,
    Context,
    Schema,
)


class ConstGenerator(BaseGenerator):
    """
    Generator that handles the `const` statements inside the schema.

    A `const` statement simply evaluates always to the same value.

    """

    def __init__(self, schema: Schema, context: Context):
        self.value = schema["const"]

    def generate(self) -> Any:
        return self.value

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        return "const" in schema
