# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles the
`allOf` directive.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from schema_fuzzer.generator.context import BaseGenerator, Context, Schema
from schema_fuzzer.joiner import join_schemas


class AllOfSchema(BaseModel):
    """
    Model providing validation for the `allOf` syntax.

    """

    model_config = ConfigDict(extra="allow", serialize_by_alias=True)
    all_of: list[Schema] = Field(alias="allOf", min_length=1)


class AllOfGenerator(BaseGenerator):
    """
    Generator that handles the `allOf` directive inside the schema.
    """

    def __init__(self, schema: Schema, context: Context):
        model = AllOfSchema.model_validate(schema)

        # This function handles the `allOf` syntax by creating a copy of the
        # schema and incpororating into it all `allOf` members.

        # First a copy of the original schema is created
        joined_schema = model.model_dump()
        # In order to avoid expanding the same `allOf` statement again inside
        # the child schema we remove it.
        del joined_schema["allOf"]
        for i, member in enumerate(model.all_of):
            # Now we incorporate each member of the original `allOf` into the
            # child schema.
            with context.trace_child(str(i)):
                joined_schema = join_schemas(
                    joined_schema,
                    member,
                    ignore={
                        "$id",
                        "version",
                        "title",
                        "description",
                        "unevaluatedProperties",
                    },
                )
        # ...and finally we create a generator for the created schema.
        with context.trace_child("allOf"):
            self.generator = context._generator(joined_schema)

    def generate(self) -> Any:
        return self.generator.generate()

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        try:
            AllOfSchema.model_validate(schema)
        except ValidationError:
            return False
        else:
            return True
