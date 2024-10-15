"""Module with tests of DataflowBuilder utilities."""

import pytest

from pipeline_manager.dataflow_builder.entities import snake_case_to_camel_case


@pytest.mark.parametrize(
    "input_name,expected_output",
    [
        ("not_snake_case", "notSnakeCase"),
        ("snake", "snake"),
        ("ant_micro123", "antMicro123"),
    ],
)
def test_snake_case_to_camel_case_conversion(
    input_name: str, expected_output: str
):
    assert snake_case_to_camel_case(input_name) == expected_output
