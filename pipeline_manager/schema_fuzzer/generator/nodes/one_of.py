# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles the
`oneOf` directive.
"""

import random
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from pipeline_manager.schema_fuzzer.generator.context import (
    BaseGenerator,
    Context,
    Schema,
)


class OneOfSchema(BaseModel):
    """
    Model providing validation for the `oneOf` syntax.

    """

    model_config = ConfigDict(extra="allow", serialize_by_alias=True)
    one_of: list[Schema] = Field(alias="oneOf", min_length=1)


class OneOfGenerator(BaseGenerator):
    """
    Generator that handles the `anyOf` directive inside the schema.

    """

    def __init__(self, schema: Schema, context: Context):
        self.model = OneOfSchema.model_validate(schema)
        self.context = context

        self.generators = []
        for i, subschema in enumerate(self.model.one_of):
            with self.context.trace_child("oneOf", str(i)):
                self.generators.append(self.context._generator(subschema))

    def generate(self) -> Any:
        generator = random.choice(self.generators)
        return generator.generate()

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        try:
            OneOfSchema.model_validate(schema)
        except ValidationError:
            return False
        else:
            return True
