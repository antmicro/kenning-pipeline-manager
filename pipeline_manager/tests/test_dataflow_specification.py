# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import jsonschema
import pytest


@pytest.fixture
def specification_invalid_property_type():
    return {
        'metadata': {},
        'nodes': [
            {
                'name': 'TestNode',
                'type': 'TestNode',
                'category': 'TestNode',
                'properties': [
                    {
                        'name': 'TestProperty',
                        'type': 'InvalidType',
                    }
                ],
                'inputs': [],
                'outputs': []
            }
        ]
    }


@pytest.fixture
def specification_missing_input():
    return {
        'metadata': {},
        'nodes': [
            {
                'name': 'TestNode',
                'type': 'TestNode',
                'category': 'TestNode',
                'properties': [],
                'outputs': []
            }
        ]
    }


@pytest.fixture
def specification_missing_output():
    return {
        'metadata': {},
        'nodes': [
            {
                'name': 'TestNode',
                'type': 'TestNode',
                'category': 'TestNode',
                'properties': [],
                'inputs': []
            }
        ]
    }


@pytest.fixture
def specification_invalid_property_value():
    return {
        'metadata': {},
        'nodes': [
            {
                'name': 'TestNode',
                'type': 'TestNode',
                'category': 'TestNode',
                'properties': [
                    {
                        'name': 'TestProperty',
                        'type': 'select',
                        'values': 'Invalid'
                    }
                ],
                'inputs': [],
                'outputs': []
            }
        ]
    }


@pytest.fixture
def specification_invalid_nodes_without_name():
    return {
        'metadata': {},
        'nodes': [
            {
                'type': 'TestNode',
                'category': 'TestNode',
                'properties': [],
                'inputs': [],
                'outputs': []
            }
        ]
    }


@pytest.fixture
def specification_invalid_nodes_without_type():
    return {
        'metadata': {},
        'nodes': [
            {
                'name': 'TestNode',
                'category': 'TestNode',
                'properties': [],
                'inputs': [],
                'outputs': []
            }
        ]
    }


def test_example_specification(sample_specification, specification_schema):
    jsonschema.validate(sample_specification, specification_schema)


@pytest.mark.parametrize(
    'invalid_specification', [
        'specification_invalid_property_type',
        'specification_missing_input',
        'specification_missing_output',
        'specification_invalid_property_value',
        'specification_invalid_nodes_without_name',
        'specification_invalid_nodes_without_type'
    ]
)
def test_invalid_specification(
        invalid_specification,
        specification_schema,
        request):
    invalid_specification = request.getfixturevalue(invalid_specification)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(invalid_specification, specification_schema)


def test_example_specification_without_metadata(sample_specification, specification_schema):  # noqa: E501
    del sample_specification['metadata']
    jsonschema.validate(sample_specification, specification_schema)


def test_example_specification_without_nodes(sample_specification, specification_schema):  # noqa: E501
    del sample_specification['nodes']
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(sample_specification, specification_schema)
