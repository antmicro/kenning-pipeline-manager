# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import pytest

from pipeline_manager.tests.conftest import check_validation, example_pairs
from pipeline_manager.validator import validate


@pytest.fixture
def specification_empty_node():
    return {
        "nodes": [
            {
                "name": "TestNode",
                "layer": "TestNode",
                "category": "TestNode",
                "properties": [],
                "interfaces": [],
            }
        ]
    }


@pytest.fixture
def specification_invalid_property_type(specification_empty_node):
    specification_empty_node["nodes"][0]["properties"].append(
        {
            "name": "TestProperty",
            "type": "InvalidType",
        }
    )
    return specification_empty_node


@pytest.fixture
def specification_invalid_property_value(specification_empty_node):
    specification_empty_node["nodes"][0]["properties"].append(
        {
            "name": "TestProperty",
            "type": "select",
            "values": "Invalid",
        }
    )
    return specification_empty_node


@pytest.fixture
def specification_nodes_without_name(specification_empty_node):
    del specification_empty_node["nodes"][0]["name"]
    return specification_empty_node


@pytest.fixture
def specification_node_as_category_not_extending(specification_empty_node):
    specification_empty_node["nodes"][0]["isCategory"] = True
    specification_empty_node["nodes"].append(
        {"name": "Q", "category": "TestNode"}
    )
    return specification_empty_node


@pytest.fixture
def specification_node_as_category_different_category_path(
    specification_empty_node
):
    specification_empty_node["nodes"][0]["isCategory"] = True
    specification_empty_node["nodes"].append(
        {"name": "Q", "category": "c/d", "extends": ["TestNode"]},
    )
    return specification_empty_node


@pytest.fixture
def specification_same_node(specification_empty_node):
    specification_empty_node["nodes"].append(
        specification_empty_node["nodes"][0]
    )
    return specification_empty_node


@pytest.fixture
def specification_same_node_name_different_category(specification_empty_node):
    specification_empty_node["nodes"].append(
        specification_empty_node["nodes"][0]
    )
    specification_empty_node["nodes"][1]["category"] = "OtherCategory"
    return specification_empty_node


@pytest.fixture
def specification_same_category():
    return {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"category": "a/B", "isCategory": True},
        ]
    }


@pytest.fixture
def specification_empty():
    return {}


@pytest.fixture
def specification_empty_nodes():
    return {"nodes": []}


@pytest.fixture
def dataflow_without_nodes():
    return {
        "graphs": [
            {
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
        ]
    }


@pytest.fixture
def specification_node_without_properties(specification_empty_node):
    del specification_empty_node["nodes"][0]["properties"]
    return specification_empty_node


@pytest.fixture
def specification_node_without_interfaces(specification_empty_node):
    del specification_empty_node["nodes"][0]["interfaces"]
    return specification_empty_node


@pytest.fixture
def specification_node_without_layer(specification_empty_node):
    del specification_empty_node["nodes"][0]["layer"]
    return specification_empty_node


@pytest.fixture
def specification_node_only_name_and_category(specification_empty_node):
    del specification_empty_node["nodes"][0]["interfaces"]
    del specification_empty_node["nodes"][0]["properties"]
    del specification_empty_node["nodes"][0]["layer"]
    return specification_empty_node


@pytest.fixture
def specification_node_as_category_with_inheriting(specification_empty_node):
    specification_empty_node["nodes"][0]["isCategory"] = True
    specification_empty_node["nodes"].append(
        {"name": "ChildNode", "extends": ["TestNode"]}
    )
    return specification_empty_node


@pytest.fixture
def specification_node_as_category_with_inheriting_nested(
    specification_empty_node
):
    specification_empty_node["nodes"][0]["isCategory"] = True
    specification_empty_node["nodes"].append(
        {
            "category": "TestNode/Double/Nested",
            "isCategory": True,
            "extends": ["TestNode"],
        }
    )
    specification_empty_node["nodes"].append(
        {"name": "Test1", "extends": ["TestNode"]}
    )
    specification_empty_node["nodes"].append(
        {"name": "Test2", "extends": ["Nested"]}
    )
    return specification_empty_node


@pytest.fixture
def specification_node_as_category_other_category_with_same_name(
    specification_empty_node
):
    specification_empty_node["nodes"][0]["isCategory"] = True
    specification_empty_node["nodes"].append(
        {"name": "Test1", "extends": ["TestNode"]}
    )
    specification_empty_node["nodes"].append(
        {"name": "Test2", "category": "Test/TestNode"}
    )
    return specification_empty_node


@pytest.mark.parametrize("example", example_pairs())
def test_all_existing_examples(example):
    """
    Tests all existing pairs of specification and dataflow files in
    examples module. It is assumed that each pair is in format
    (*-specification.json, *-dataflow.json).
    """
    spec, dataflow = example
    assert validate(spec, [dataflow]) == 0


@pytest.mark.parametrize(
    "valid_specification",
    [
        "specification_node_without_properties",
        "specification_node_without_interfaces",
        "specification_node_without_layer",
        "specification_node_only_name_and_category",
        "specification_node_as_category_with_inheriting",
        "specification_node_as_category_with_inheriting_nested",
        "specification_node_as_category_other_category_with_same_name",
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
        "specification_nodes_without_name",
        "specification_node_as_category_not_extending",
        "specification_node_as_category_different_category_path",
        "specification_same_node",
        "specification_same_node_name_different_category",
        "specification_same_category",
        "specification_empty",
        "specification_empty_nodes",
        "dataflow_without_nodes",
    ],
)
def test_invalid_specification(
    prepare_validation_environment, invalid_specification, request
):
    invalid_specification = request.getfixturevalue(invalid_specification)
    assert check_validation(invalid_specification) == 1
