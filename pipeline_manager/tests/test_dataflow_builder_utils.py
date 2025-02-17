"""Module with tests of GraphBuilder utilities."""

import pytest

from pipeline_manager.dataflow_builder.entities import (
    camel_case_to_snake_case,
    snake_case_to_camel_case,
)


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
