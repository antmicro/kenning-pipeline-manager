# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles the
`union` syntax.
"""

import copy
import random
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from pipeline_manager.schema_fuzzer.generator.context import (
    BaseGenerator,
    Context,
    Schema,
)


class UnionSchema(BaseModel):
    """
    Model that handles validation for the `union` syntax.

    """

    model_config = ConfigDict(extra="allow", serialize_by_alias=True)
    type_field: list[str] = Field(min_length=1, alias="type")


class UnionGenerator(BaseGenerator):
    """
    Generator that hnadles the `union` statements inside the schema.

    A `union` statements allows to create objects of any types from the
    provided list. The most popular usecase for it is creating nullable values.
    The generator expands the provided schema, using the type list, into
    multiple child schemas with concetrete types. Each sample will be generated
    based of a randomly picked child schema.
    """

    def __init__(self, schema: Schema, context: Context):
        self.model = UnionSchema.model_validate(schema)
        self.generators = []
        for member in self.model.type_field:
            # For each union member we create a subschema with its respective
            # type.
            subschema = copy.deepcopy(schema)
            subschema["type"] = member
            # This subschema is then used to create a new generator.
            with context.trace_child("member", member):
                generator = context._generator(subschema)
            self.generators.append(generator)

    def generate(self) -> Any:
        # We pick a random child schema generator.
        generator = random.choice(self.generators)
        return generator.generate()

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        try:
            UnionSchema.model_validate(schema)
        except ValidationError:
            return False
        else:
            return True
