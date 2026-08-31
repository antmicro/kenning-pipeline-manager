# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles objects
of type `object`.
"""

import random
import re
import string
from collections import Counter
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from schema_fuzzer.generator.context import BaseGenerator, Context, Schema


class ObjectSchema(BaseModel):
    """
    Model providing validation for the `object` object syntax.

    """

    type_field: Literal["object"] = Field(alias="type")
    properties: dict[str, Any] | None = None
    pattern_properties: dict[str, Any] | None = Field(
        alias="patternProperties", default=None
    )
    required: list[str] | None = None

    @model_validator(mode="after")
    def model_check(self) -> "ObjectSchema":
        """
        Check the provided constraints for contradictions.

        """
        pattern_properties = self.pattern_properties or {}
        for pattern in pattern_properties.keys():
            try:
                re.compile(pattern)
            except re.PatternError as ex:
                raise ValueError(f"Invalid pattern: {ex}")

        properties = self.properties or {}

        counter = Counter(self.required)
        for field, count in counter.items():
            if count != 1:
                breakpoint()
                raise ValueError(f"Duplicate `required` entry: {field}")
            if field in properties:
                continue
            for pattern in pattern_properties.keys():
                if re.match(pattern, field):
                    break
            else:
                raise ValueError(f"Missing field schema: {field}")

        return self


class ObjectConfig(BaseModel):
    """
    Configuration model for the `object` generator.

    Attributes
    ----------
    strategy : Literal["all", "required"]
        Strategy dictating which object fields should be generated in the
        samples.
    min_pattern_properties : int
        Minimum amount of generated properties from the `patternProperties`
        field.
    max_pattern_properties : int
        Maximum amount of generated properties from the `patternProperties`
        field.
    pattern_alphabet : str
        A string comprising of characters used when generating new field names
        for the `patternProperties` fields.
    min_pattern_length : int
        Minimum length of generated name for the `patternProperties` field
        names.
    max_pattern_length : int
        Minimum length of generated name for the `patternProperties` field
        names.

    """

    strategy: Literal["all", "required"] = "all"
    min_pattern_properties: int = 0
    max_pattern_properties: int = 10
    pattern_alphabet: str = string.ascii_letters
    min_pattern_length: int = 0
    max_pattern_length: int = 10


class ObjectGenerator(BaseGenerator):
    """
    Generator that handles generating new `object` type objects.

    Note
    ----
    This generator implements only a subset of the JSON Schema. The following
    constraints `maxProperties`, `minProperties`, `dependentRequired` will be
    ignored. Keywords `additionalProperties` and `propertyNames` will also be
    ignored. The `patternProperties` keyword is supported only for the `^.*$`
    pattern. Attempting to use generator object with unsupported pattern will
    result in `NotImplementedError`.

    """

    def __init__(self, schema: Schema, context: Context):
        self.model = ObjectSchema.model_validate(schema)
        self.config = context.get_config(ObjectConfig)

        self.generators: dict[str, BaseGenerator] = {}
        self.pattern_generators: dict[str, BaseGenerator] = {}

        properties = self.model.properties or {}
        pattern_properties = self.model.pattern_properties or {}
        required = self.model.required or []
        match self.config.strategy:
            case "all":
                for field, subschema in properties.items():
                    with context.trace_child("properties", field):
                        generator = context._generator(subschema)
                    self.generators[field] = generator
                for pattern, subschema in pattern_properties.items():
                    with context.trace_child("patternProperties", pattern):
                        generator = context._generator(subschema)
                    self.pattern_generators[pattern] = generator
            case "required":
                for field in required:
                    if field in properties:
                        with context.trace_child("properties", field):
                            generator = context._generator(properties[field])
                        self.generators[field] = generator
                        continue
                    for pattern in pattern_properties.keys():
                        if re.match(pattern, field):
                            with context.trace_child(
                                "patternProperties", pattern
                            ):
                                generator = context._generator(
                                    pattern_properties[pattern]
                                )
                            self.generators[field] = generator
                            break

    def _generate_name(self, pattern: str) -> str:
        if pattern not in {"^.*$", ".*"}:
            raise NotImplementedError(f"Unsupported pattern: {pattern}")
        length = random.randint(
            self.config.min_pattern_length, self.config.max_pattern_length
        )
        return "".join(random.choices(self.config.pattern_alphabet, k=length))

    def generate(self) -> dict[str, Any]:
        generated = {}
        for field, generator in self.generators.items():
            generated[field] = generator.generate()
        for pattern, generator in self.pattern_generators.items():
            amount = random.randint(
                self.config.min_pattern_properties,
                self.config.max_pattern_properties,
            )
            for _ in range(amount):
                while True:
                    field = self._generate_name(pattern)
                    if field not in generated:
                        break
                generated[field] = generator.generate()
        return generated

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        return "type" in schema and schema["type"] == "object"

    @classmethod
    def get_config_class(cls) -> type[BaseModel]:
        return ObjectConfig
