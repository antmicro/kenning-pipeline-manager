# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles objects
of type `number`.
"""

import math
import random
from typing import Literal

from pydantic import BaseModel, Field, computed_field, model_validator

from pipeline_manager.schema_fuzzer.generator.context import (
    BaseGenerator,
    Context,
    Schema,
)


class NumberSchema(BaseModel):
    """
    Model providing validation for the `number` object syntax.
    """

    type_field: Literal["number"] = Field(alias="type")
    minimum: float | None = None
    maximum: float | None = None
    minimum_exclusive: float | None = Field(
        alias="minimumExclusive", default=None
    )
    maximum_exclusive: float | None = Field(
        alias="maximumExclusive", default=None
    )

    @computed_field
    @property
    def lower_bound(self) -> float | None:
        """
        The smallest inclusive lower bound value that satisfies both the
        `minimum` and `minimumExclusive` constraints.

        """
        if self.minimum is None and self.minimum_exclusive is None:
            return None
        lower_bound = self.minimum
        minimum_exclusive = self.minimum_exclusive or -math.inf
        minimum_inclusive = math.nextafter(minimum_exclusive, math.inf)
        if lower_bound is None or lower_bound < minimum_inclusive:
            lower_bound = minimum_inclusive
        return lower_bound

    @computed_field
    @property
    def upper_bound(self) -> float | None:
        """
        The largest inclusive lower bound value that satisfies both the
        `maximum` and `maximumExclusive` constraints.

        """
        if self.maximum is None and self.maximum_exclusive is None:
            return None
        upper_bound = self.maximum
        maximum_exclusive = self.maximum_exclusive or math.inf
        maximum_inclusive = math.nextafter(maximum_exclusive, -math.inf)
        if upper_bound is None or upper_bound > maximum_inclusive:
            upper_bound = maximum_inclusive
        return upper_bound

    @model_validator(mode="after")
    def check_model(self) -> "NumberSchema":
        """
        Check if there exist an integer satisfying the provided constraints.

        """
        lower_bound = self.lower_bound or -math.inf
        upper_bound = self.upper_bound or math.inf
        if math.isnan(lower_bound) or math.isnan(upper_bound):
            raise ValueError("Range boundary value cannot be a NaN")
        if lower_bound > upper_bound:
            raise ValueError(
                "Unsatisfiable constraint for x: "
                f"{self.lower_bound:.3f} <= x <= {self.upper_bound:.3f}"
            )
        return self


class NumberConfig(BaseModel):
    """
    Configuration model for the `number` generator.

    Attributes
    ----------
    negative_infinity : float
        Used for the default lower bound is no minimum value constraints was
        provided by the schema.
    positive_infinity : float
        Used for the default lower bound is no minimum value constraints was
        provided by the schema.

    """

    negative_infinity: float = Field(default=-1e3)
    positive_infinity: float = Field(default=+1e3)


class NumberGenerator(BaseGenerator):
    """
    Generator that handles generation of the `number` type object.

    It is worth to emphasize that while JSON (RFC 8259) does not distinguish
    between integer and floating point numerical values, JSON Schema
    specification does. `NumberGenerator`, per specification, will generate
    floating point numbers, if you need integer values use `IntegerGenerator`.

    """

    def __init__(self, schema: Schema, context: Context):
        self.model = NumberSchema.model_validate(schema)
        self.config = context.get_config(NumberConfig)

    def generate(self) -> float:
        lower_bound = self.model.lower_bound or self.config.negative_infinity
        upper_bound = self.model.upper_bound or self.config.positive_infinity

        return random.uniform(lower_bound, upper_bound)

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        return "type" in schema and schema["type"] == "number"

    @classmethod
    def get_config_class(cls) -> type[BaseModel]:
        return NumberConfig
