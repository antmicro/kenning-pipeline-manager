# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import pytest

from pipeline_manager.tests.conftest import check_validation, example_pairs
from pipeline_manager.validator import validate


@pytest.fixture
def specification_invalid_property_type():
    return {
        "nodes": [
            {
                "name": "TestNode",
                "layer": "TestNode",
                "category": "TestNode",
                "properties": [
                    {
                        "name": "TestProperty",
                        "type": "InvalidType",
                    }
                ],
                "interfaces": [],
            }
        ]
    }


@pytest.fixture
def specification_invalid_property_value():
    return {
        "nodes": [
            {
                "name": "TestNode",
                "layer": "TestNode",
                "category": "TestNode",
                "properties": [
                    {
                        "name": "TestProperty",
                        "type": "select",
                        "values": "Invalid",
                    }
                ],
                "interfaces": [],
            }
        ]
    }


@pytest.fixture
def specification_invalid_nodes_without_name():
    return {
        "nodes": [
            {
                "layer": "TestNode",
                "category": "TestNode",
                "properties": [],
                "interfaces": [],
            }
        ]
    }


@pytest.fixture
def specification_invalid_node_as_category_not_extending():
    return {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "category": "a/B"},
        ]
    }


@pytest.fixture
def specification_invalid_node_as_category_different_category_path():
    return {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "category": "c/d", "extends": ["B"]},
        ]
    }


@pytest.fixture
def specification_invalid_same_node_name():
    return {
        "nodes": [
            {
                "name": "TestNode",
            },
            {
                "name": "TestNode",
            },
        ]
    }


@pytest.fixture
def specification_invalid_same_node_name_and_category():
    return {
        "nodes": [
            {
                "name": "TestNode",
                "category": "TestNode",
            },
            {
                "name": "TestNode",
                "category": "TestNode",
            },
        ]
    }


@pytest.fixture
def specification_invalid_same_node_name_different_category():
    return {
        "nodes": [
            {
                "name": "TestNode",
                "category": "TestNodeFirst",
            },
            {
                "name": "TestNode",
                "category": "TestNodeSecond",
            },
        ]
    }


@pytest.fixture
def specification_invalid_same_category():
    return {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"category": "a/B", "isCategory": True},
        ]
    }


@pytest.fixture
def specification_invalid_empty():
    return {}


@pytest.fixture
def dataflow_valid_node_property_text():
    return {
        "graph": {
            "connections": [],
            "id": "78cc86c4-9ad0-4a8f-88cb-71ee28c48659",
            "nodes": [
                {
                    "name": "SaveVideo",
                    "id": "fc7d1706-6240-41e2-a8da-91c8577e09f9",
                    "position": {"x": 2100, "y": 200},
                    "interfaces": [
                        {
                            "direction": "input",
                            "id": "6efb374c-a115-404e-ade8-0aa05ba93996",
                            "name": "frames",
                            "side": "left",
                            "sidePosition": 0,
                        }
                    ],
                    "properties": [
                        {
                            "id": "3039e744-9941-47c5-8902-f260e6c29a35",
                            "name": "filename",
                            "value": "/some/file/path",
                        }
                    ],
                    "twoColumn": True,
                }
            ],
        }
    }


@pytest.fixture
def specification_valid_nodes_without_properties():
    return {
        "nodes": [
            {
                "name": "TestNode",
                "layer": "TestNode",
                "category": "TestNode",
                "interfaces": [],
            }
        ]
    }


@pytest.fixture
def specification_valid_nodes_without_interfaces():
    return {
        "nodes": [
            {
                "name": "TestNode",
                "layer": "TestNode",
                "category": "TestNode",
                "properties": [],
            }
        ]
    }


@pytest.fixture
def specification_valid_nodes_without_layer():
    return {
        "nodes": [
            {
                "name": "TestNode",
                "category": "TestNode",
                "properties": [],
                "interfaces": [],
            }
        ]
    }


@pytest.fixture
def specification_valid_nodes_only_name_and_category():
    return {
        "nodes": [
            {
                "name": "TestNode",
                "category": "TestNode",
            }
        ]
    }


@pytest.fixture
def specification_valid_node_as_category_with_inheriting():
    return {
        "nodes": [
            {"category": "TestNode", "isCategory": True},
            {"name": "ChildNode", "extends": ["TestNode"]},
        ]
    }


@pytest.fixture
def specification_valid_node_as_category_with_inheriting_nested():
    return {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"category": "a/B/c/D", "isCategory": True, "extends": ["B"]},
            {"name": "Q", "extends": ["B"]},
            {"name": "Y", "extends": ["D"]},
        ]
    }


@pytest.fixture
def specification_valid_node_as_category_other_category_with_same_name():
    return {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "extends": ["B"]},
            {"name": "Z", "category": "c/B"},
        ]
    }


@pytest.mark.parametrize("example", example_pairs())
def test_all_existing_examples(example):
    """
    Tests all existing pairs of specification and dataflow files in
    examples module. It is assumed that each pair is in format
    (*-specification.json, *-dataflow.json).
    """
    spec, dataflow = example
    assert validate(spec, dataflow) == 0


@pytest.mark.parametrize(
    "valid_specification",
    [
        "specification_valid_nodes_without_properties",
        "specification_valid_nodes_without_interfaces",
        "specification_valid_nodes_without_layer",
        "specification_valid_nodes_only_name_and_category",
        "specification_valid_node_as_category_with_inheriting",
        "specification_valid_node_as_category_with_inheriting_nested",
        "specification_valid_node_as_category_other_category_with_same_name",
    ],
)
def test_valid_specification(
    prepare_validation_environment, valid_specification, request
):
    valid_specification = request.getfixturevalue(valid_specification)
    assert check_validation(valid_specification) == 0


@pytest.mark.parametrize(
    "invalid_specification",
    [
        "specification_invalid_property_type",
        "specification_invalid_property_value",
        "specification_invalid_nodes_without_name",
        "specification_invalid_node_as_category_not_extending",
        "specification_invalid_node_as_category_different_category_path",
        "specification_invalid_same_node_name",
        "specification_invalid_same_node_name_and_category",
        "specification_invalid_same_node_name_different_category",
        "specification_invalid_same_category",
        "specification_invalid_empty",
        "dataflow_valid_node_property_text",
    ],
)
def test_invalid_specification(
    prepare_validation_environment, invalid_specification, request
):
    invalid_specification = request.getfixturevalue(invalid_specification)
    assert check_validation(invalid_specification) == 1
