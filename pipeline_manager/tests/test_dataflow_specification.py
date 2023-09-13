# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import json
import pytest
import tempfile
from pipeline_manager.validator import validate
from pathlib import Path


def check_validation(spec):
    with tempfile.TemporaryDirectory() as tmpdir:
        specpath = Path(tmpdir) / 'spec.json'
        with open(specpath, 'w') as specfile:
            json.dump(spec, specfile)
        res = validate(specpath)
    return res


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


def test_example_specification(
        prepare_validation_environment,
        sample_specification):
    assert check_validation(sample_specification) == 0


@pytest.mark.parametrize(
    'valid_specification', [
        'specification_valid_nodes_without_properties',
        'specification_valid_nodes_without_interfaces',
        'specification_valid_nodes_without_layer',
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


def test_example_specification_without_nodes(
        sample_specification):
    del sample_specification['nodes']
    assert check_validation(sample_specification) == 1
