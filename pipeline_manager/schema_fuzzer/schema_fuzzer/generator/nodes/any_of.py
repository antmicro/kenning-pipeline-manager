# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles the
`anyOf` directive.
"""

import functools
import random
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from schema_fuzzer.generator.context import BaseGenerator, Context, Schema
from schema_fuzzer.joiner import join_schemas


class AnyOfSchema(BaseModel):
    """
    Model providing validation for the `anyOf` syntax.

    """

    model_config = ConfigDict(extra="allow", serialize_by_alias=True)
    any_of: list[Schema] = Field(alias="anyOf", min_length=1)


class AnyOfConfig(BaseModel):
    """
    Configuration model for the `anyOf` generator.

    """

    pick: int = Field(default=1, ge=-1)


class AnyOfGenerator(BaseGenerator):
    """
    Generator that handles the `anyOf` directive inside the schema.

    """

    def __init__(self, schema: Schema, context: Context):
        self.model = AnyOfSchema.model_validate(schema)
        self.context = context
        self.config = self.context.get_config(AnyOfConfig)

        # If configured with `-1` use all members.
        if self.config.pick == -1:
            self.config.pick = len(self.model.any_of)

    def get_random_generator(self) -> BaseGenerator:
        # This function handles creating generators for random combinations of
        # the members. In order to avoid rebuilding the generator tree on every
        # iteration we cache generators for combination that were already used.

        @functools.cache
        def get_generator(combination: str) -> BaseGenerator:
            # This function accepts a string comprising of "Y" and "N"
            # characters, indicating whether to incorporate given members into
            # the returned generator.

            # This function accepts string as an argument as `functools.cache`
            # requires something hashable to work.

            # First we create a copy of the original schema with the selected
            # members incporporated.
            schema = self.model.model_dump()
            # We remove "anyOf" from the copied schema to avoid expanding it in
            # again in the child schemas.
            del schema["anyOf"]
            for i, pick in enumerate(combination):
                # We incorporate those members for which "Y" is provided.
                if pick == "Y":
                    schema = join_schemas(schema, self.model.any_of[i])

            # ...and finally we return the generator for the newly created
            # schema.
            with self.context.trace_child("anyOf", combination):
                return self.context._generator(schema)

        # Generate random combination of "Y" and "N"
        choices = ["N"] * len(self.model.any_of)
        indices = random.sample(range(len(choices)), self.config.pick)
        for i in indices:
            choices[i] = "Y"

        combination = "".join(choices)
        return get_generator(combination)

    def generate(self) -> Any:
        generator = self.get_random_generator()
        return generator.generate()

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        try:
            AnyOfSchema.model_validate(schema)
        except ValidationError:
            return False
        else:
            return True

    @classmethod
    def get_config_class(cls) -> type[BaseModel]:
        return AnyOfConfig
