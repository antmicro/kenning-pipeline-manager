# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import json
import tempfile
from pathlib import Path

import pytest

from pipeline_manager.validator import validate
from pipeline_manager.tests.conftest import check_validation, example_pairs


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


@pytest.fixture
def specification_valid_nodes_without_properties():
    return {
        'nodes': [
            {
                'name': 'TestNode',
                'layer': 'TestNode',
                'category': 'TestNode',
                'interfaces': []
            }
        ]
    }


@pytest.fixture
def specification_valid_nodes_without_interfaces():
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
def specification_valid_nodes_without_layer():
    return {
        'nodes': [
            {
                'name': 'TestNode',
                'category': 'TestNode',
                'properties': [],
                'interfaces': []
            }
        ]
    }


@pytest.fixture
def specification_valid_nodes_only_name_and_category():
    return {
        'nodes': [
            {
                'name': 'TestNode',
                'category': 'TestNode',
            }
        ]
    }


@pytest.mark.parametrize('example', example_pairs())
def test_all_existing_examples(example):
    """
    Tests all exsiting pairs of specification and dataflow files in
    examples module. It is assumed that each pair is in format
    (*-specification.json, *-dataflow.json).
    """
    spec, dataflow = example
    assert validate(spec, dataflow) == 0


@pytest.mark.parametrize(
    'valid_specification', [
        'specification_valid_nodes_without_properties',
        'specification_valid_nodes_without_interfaces',
        'specification_valid_nodes_without_layer',
        'specification_valid_nodes_only_name_and_category'
    ]
)
def test_valid_specification(
        prepare_validation_environment,
        valid_specification,
        request):
    valid_specification = request.getfixturevalue(valid_specification)
    assert check_validation(valid_specification) == 0


@pytest.mark.parametrize(
    'invalid_specification', [
        'specification_invalid_property_type',
        'specification_invalid_property_value',
        'specification_invalid_nodes_without_name',
    ]
)
def test_invalid_specification(
        prepare_validation_environment,
        invalid_specification,
        request):
    invalid_specification = request.getfixturevalue(invalid_specification)
    assert check_validation(invalid_specification) == 1
