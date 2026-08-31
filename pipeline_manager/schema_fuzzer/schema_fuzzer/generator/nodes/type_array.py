# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles objects
of type `array`.
"""

import random
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from schema_fuzzer.generator.context import BaseGenerator, Context, Schema


class ArraySchema(BaseModel):
    """
    Model providing validation for the `array` object syntax.

    """

    type_field: Literal["array"] = Field(alias="type")
    items: Schema | None = None
    min_items: int | None = Field(alias="minItems", default=None, ge=0)
    max_items: int | None = Field(alias="maxItems", default=None, ge=1)

    @model_validator(mode="after")
    def check_model(self) -> "ArraySchema":
        if self.min_items is not None and self.max_items is not None:
            if self.min_items > self.max_items:
                raise ValueError(
                    "`minItems` cannot be greater than `maxItems`"
                )
        return self


class ArrayConfig(BaseModel):
    """
    Configuration model for the `array` generator.

    Attributes
    ----------
    min_items : int
        Used for the default `minItems` value if the schema doesn not provide
        it.
    max_items : int
        Used for the default `maxItems` value if the schema doesn not provide
        it.
    """

    min_items: int = Field(default=0, ge=0)
    max_items: int = Field(default=20, ge=0)


class ArrayGenerator(BaseGenerator):
    """
    Generator that handles generation of the `array` type objects.

    Note
    ----
    This generator supports only a subset of the entire `array` object syntax.
    The following keywords: `prefixItems`, `contains`, `uniqueItems`,
    `maxContains`, and `minContains` are not supported yet and will be ignored.

    """

    def __init__(self, schema: Schema, context: Context):
        self.model = ArraySchema.model_validate(schema)
        if self.model.items:
            with context.trace_child("items"):
                self.generator = context._generator(self.model.items)
        self.config = context.get_config(ArrayConfig)

    def generate(self) -> list[Any]:
        if self.model.items is None:
            return []
        min_items = self.model.min_items or self.config.min_items
        max_items = self.model.max_items or self.config.max_items
        length = random.randint(min_items, max_items)
        items = []
        for _ in range(length):
            items.append(self.generator.generate())
        return items

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        return "type" in schema and schema["type"] == "array"

    @classmethod
    def get_config_class(cls) -> type[BaseModel]:
        return ArrayConfig
