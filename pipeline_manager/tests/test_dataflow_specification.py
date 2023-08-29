# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import jsonschema
import pytest


@pytest.fixture
def specification_invalid_property_type():
    return {
        'nodes': [
            {
                'name': 'TestNode',
                'layer': 'TestNode',
                'category': 'TestNode',
                'properties': [
                    {
                        'name': 'TestProperty',
                        'type': 'InvalidType',
                    }
                ],
                'interfaces': []
            }
        ]
    }


@pytest.fixture
def specification_missing_interfaces():
    return {
        'nodes': [
            {
                'name': 'TestNode',
                'layer': 'TestNode',
                'category': 'TestNode',
                'properties': []
            }
        ]
    }


@pytest.fixture
def specification_invalid_property_value():
    return {
        'nodes': [
            {
                'name': 'TestNode',
                'layer': 'TestNode',
                'category': 'TestNode',
                'properties': [
                    {
                        'name': 'TestProperty',
                        'type': 'select',
                        'values': 'Invalid'
                    }
                ],
                'interfaces': [],
            }
        ]
    }


@pytest.fixture
def specification_invalid_nodes_without_name():
    return {
        'nodes': [
            {
                'layer': 'TestNode',
                'category': 'TestNode',
                'properties': [],
                'interfaces': []
            }
        ]
    }


def test_example_specification(sample_specification, specification_validator):
    specification_validator.validate(sample_specification)


@pytest.mark.parametrize(
    'invalid_specification', [
        'specification_invalid_property_type',
        'specification_missing_interfaces',
        'specification_invalid_property_value',
        'specification_invalid_nodes_without_name',
    ]
)
def test_invalid_specification(
        invalid_specification,
        specification_validator,
        request):
    invalid_specification = request.getfixturevalue(invalid_specification)
    with pytest.raises(jsonschema.ValidationError):
        specification_validator.validate(invalid_specification)


def test_example_specification_without_nodes(sample_specification, specification_validator):  # noqa: E501
    del sample_specification['nodes']
    with pytest.raises(jsonschema.ValidationError):
        specification_validator.validate(sample_specification)
