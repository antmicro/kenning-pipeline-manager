"""
Module that provides implementation of the BaseGenerator, that handles objects
of type `string`.
"""

import random
import re
import string
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from schema_fuzzer.generator.context import BaseGenerator, Context, Schema


class StringSchema(BaseModel):
    """
    Model providing validation for the `string` object syntax.
    """

    type_field: Literal["string"] = Field(alias="type")
    min_length: int | None = Field(alias="minLength", default=None, ge=0)
    max_length: int | None = Field(alias="maxLength", default=None, ge=0)
    pattern: str | None = None

    @model_validator(mode="after")
    def check_model(self) -> "StringSchema":
        """
        Check provided constraints for contradictions.

        """
        if self.min_length is not None and self.max_length is not None:
            if self.min_length > self.max_length:
                raise ValueError(
                    "Unsatisfiable constrain: "
                    "`minLength` is greater than `maxLength`"
                )

        if self.pattern is not None:
            try:
                re.compile(self.pattern)
            except re.PatternError as ex:
                raise ValueError(f"`Invalid constrain pattern: {ex}")

        return self


class StringConfig(BaseModel):
    """
    Configuration model for the `string` generator.

    Attributes
    ----------
    min_length : int
        Default minimum length value, used in case the provided schema doesn't
        provide this constrain.
    max_length : int
        Default maximum length value, used in case the provided schema doesn't
        provide this constrain.
    alphabet : str:
        A string comprising of all characters that will be used in generated
        samples.

    """

    min_length: int = Field(default=0)
    max_length: int = Field(default=20)
    alphabet: str = Field(default=string.ascii_letters)


class StringGenerator(BaseGenerator):
    """
    Generator that handles generating `string` type object.

    Note
    ----
    This generator implements only a subset of the JSON Schema specification.
    The `pattern` constrain is supported only if the provided pattern is
    `^.*$`. Attempting to instantiate the generator with unsupported pattern
    will result in `NotImplementedError`.

    """

    def __init__(self, schema: Schema, context: Context):
        self.model = StringSchema.model_validate(schema)
        self.config = context.get_config(StringConfig)

    def generate(self) -> str:
        if self.model.pattern is None or self.model.pattern == "^.*$":
            min_length = self.model.min_length or self.config.min_length
            max_length = self.model.max_length or self.config.max_length
            length = random.randint(min_length, max_length)
            return "".join(random.choices(self.config.alphabet, k=length))

        raise NotImplementedError("Unsupported pattern used")

    @classmethod
    def is_associated(cls, schema: Schema) -> bool:
        return "type" in schema and schema["type"] == "string"

    @classmethod
    def get_config_class(cls) -> type[BaseModel]:
        return StringConfig
