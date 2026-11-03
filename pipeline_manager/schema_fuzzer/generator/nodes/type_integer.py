# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides implementation of the BaseGenerator, that handles objects
of type `integer`.
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


def _round_up(n: int, multiple_of: int) -> int:
    return multiple_of * math.ceil(n / multiple_of)


def _round_down(n: int, multiple_of: int) -> int:
    return multiple_of * math.floor(n / multiple_of)


def _round_nearest(n: int, multiple_of: int) -> int:
    return multiple_of * round(n / multiple_of)


class IntegerSchema(BaseModel):
    """
    Model providing validation for the `integer` object syntax.

    """

    type_field: Literal["integer"] = Field(validation_alias="type")
    multiple_of: int | None = Field(alias="multipleOf", default=None, gt=0)
    minimum: int | None = None
    maximum: int | None = None
    minimum_exclusive: int | None = Field(
        alias="minimumExclusive", default=None
    )
    maximum_exclusive: int | None = Field(
        alias="maximumExclusive", default=None
    )

    @computed_field
    @property
    def lower_bound(self) -> int | None:
        """
        The smallest inclusive lower bound value that satisfies both the
        `minimum` and `minimumExclusive` constraints.

        """
        if self.minimum is None and self.minimum_exclusive is None:
            return None
        lower_bound = self.minimum
        if (
            lower_bound is None
            or self.minimum_exclusive is not None
            and lower_bound < self.minimum_exclusive + 1
        ):
            assert self.minimum_exclusive is not None, "Not reachable"
            lower_bound = self.minimum_exclusive + 1
        return lower_bound

    @computed_field
    @property
    def upper_bound(self) -> int | None:
        """
        The largest inclusive lower bound value that satisfies both the
        `maximum` and `maximumExclusive` constraints.

        """
        if self.maximum is None and self.maximum_exclusive is None:
            return None
        upper_bound = self.maximum
        if (
            upper_bound is None
            or self.maximum_exclusive is not None
            and upper_bound > self.maximum_exclusive - 1
        ):
            assert self.maximum_exclusive is not None, "Not reachable"
            upper_bound = self.maximum_exclusive - 1
        return upper_bound

    @model_validator(mode="after")
    def check_model(self) -> "IntegerSchema":
        """
        Check if there exist an integer satisfying the provided constraints.
        """
        # If the set of allowed values in unbounded from either side
        # constraints will always be satisfiable.
        if self.lower_bound is None or self.upper_bound is None:
            return self

        # Check if the lower bound isn't greater than the upper one.
        if self.lower_bound > self.upper_bound:
            raise ValueError(
                "Unsatisfiable constraint for x: "
                f"{self.lower_bound} <= x <= {self.upper_bound}"
            )

        if self.multiple_of is None:
            return self

        # Here we check if an multiple of the requested value exist between
        # specified bounds. We do it by finding the smallest multiple of the
        # requested value greater than the lower bound. If it is greater than
        # the upper_bound the constraints cannot be satisfied.
        smallest_multiple = _round_up(self.lower_bound, self.multiple_of)
        if smallest_multiple > self.upper_bound:
            raise ValueError(
                "Unsatisfiable constraints: "
                f"{self.lower_bound} <= x <= {self.upper_bound} "
                f"and {self.multiple_of}|x"
            )
        return self


class IntegerConfig(BaseModel):
    """
    Configuration model for the `integer` generator.

    Attributes
    ----------
    negative_infinity : int
        Used for the default lower bound is no minimum value constraints was
        provided by the schema.
    positive_infinity : int
        Used for the default lower bound is no minimum value constraints was
        provided by the schema.

    """

    negative_infinity: int = Field(default=-100)
    positive_infinity: int = Field(default=+100)


class IntegerGenerator(BaseGenerator):
    """
    Generator that handles generating `integer` type objects.

    """

    def __init__(self, schema: Schema, context: Context):
        self.model = IntegerSchema.model_validate(schema)
        self.config = context.get_config(IntegerConfig)

    def generate(self) -> int:
        lower_bound = self.model.lower_bound or self.config.negative_infinity
        upper_bound = self.model.upper_bound or self.config.positive_infinity

        if self.model.multiple_of is None:
            return random.randint(lower_bound, upper_bound)

        lower_bound = _round_up(lower_bound, self.model.multiple_of)
        upper_bound = _round_down(upper_bound, self.model.multiple_of)
        value = random.randint(lower_bound, upper_bound)
        return _round_nearest(value, self.model.multiple_of)

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        return "type" in schema and schema["type"] == "integer"

    @classmethod
    def get_config_class(cls) -> type[BaseModel]:
        return IntegerConfig
