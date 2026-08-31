# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles the
`enum` syntax.
"""

import random
from typing import Any

from pydantic import BaseModel, Field

from schema_fuzzer.generator.context import BaseGenerator, Context, Schema


class EnumSchema(BaseModel):
    """
    Model providing validation for the `enum` syntax.

    """

    enum: list[Any] = Field(min_length=1)


class EnumGenerator(BaseGenerator):
    """
    Generator that handles the `enum` statements.

    An `enum` statement provides an array of possible values. This generator
    simply picks one at random.

    """

    def __init__(self, schema: Schema, context: Context):
        self.model = EnumSchema.model_validate(schema)

    def generate(self) -> Any:
        return random.choice(self.model.enum)

    @classmethod
    def is_associated(cls, schema: Schema):
        return "enum" in schema
