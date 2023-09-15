# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import json
import pytest

from pipeline_manager.validator import validate
from pipeline_manager.tests.conftest import example_pairs
from pipeline_manager.specification_builder import SpecificationBuilder


@pytest.fixture
def specification_builder(
        unresolved_specification_schema) -> SpecificationBuilder:
    return SpecificationBuilder(unresolved_specification_schema['version'])


@pytest.mark.parametrize('example', example_pairs())
def test_existing_examples(
        example,
        specification_builder: SpecificationBuilder,
        empty_file_path):
    """
    Takes all existing configurations from example module and
    checks whether SpecificationBuilder can recreate specifications correctly.
    """
    spec_path, dataflow_path = example

    if spec_path.name == 'sample-interface-groups-specification.json':
        pytest.xfail("Groups of interfaces are not yet implemented for Specification Builder")  # noqa: E501

    with open(spec_path, 'r') as f:
        spec = json.load(f)

    specification_builder.update_spec_from_other(spec)
    recreated_spec = specification_builder.create_and_validate_spec()

    with open(empty_file_path, 'w') as f:
        json.dump(recreated_spec, f)

    assert validate(empty_file_path, dataflow_path) == 0
