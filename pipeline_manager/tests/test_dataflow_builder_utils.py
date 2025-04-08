"""Module with tests of GraphBuilder utilities."""

import pytest

from pipeline_manager.dataflow_builder.entities import (
    camel_case_to_snake_case,
    snake_case_to_camel_case,
)
from pipeline_manager.dataflow_builder.utils import get_public_attributes


@pytest.mark.parametrize(
    "input_name,expected_output",
    [
        ("not_snake_case", "notSnakeCase"),
        ("snake", "snake"),
        ("happy_elephant123", "happyElephant123"),
    ],
)
def test_snake_case_to_camel_case_conversion(
    input_name: str, expected_output: str
):
    """Test if snake-cased names are converted to camel-cased names."""
    assert snake_case_to_camel_case(input_name) == expected_output


@pytest.mark.parametrize(
    "input_name,expected_output",
    (
        ("whatIsThat", "what_is_that"),
        ("variable", "variable"),
        ("happyElephant456", "happy_elephant456"),
    ),
)
def test_camel_case_to_snake_case(input_name: str, expected_output: str):
    """Test if camel-cased names are converted to snake-cased names."""
    assert camel_case_to_snake_case(input_name) == expected_output


def test_getting_public_attributes():
    """Test if getting public attributes of a class instance works."""

    class ExampleClass:
        def __init__(self):
            self.a = "X"
            self.b = "Y"
            self.c = "Z"
            self._d = "ABC"

        @property
        def d(self) -> str:
            return self._d

        @d.setter
        def d(self, value: str):
            if len(value) != 3:
                raise ValueError("Expected str of length equal to 3.")
            self._d = value

    assert get_public_attributes(ExampleClass()) == ["a", "b", "c", "d"]
