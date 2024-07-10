# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

from copy import deepcopy

import pytest

from pipeline_manager.tests.conftest import check_validation, example_pairs
from pipeline_manager.validator import validate

# ----------------------------------
# NOTE: Specifications with nodes only
# ----------------------------------


@pytest.fixture
def specification_blank_node():
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
def specification_one_interface(specification_blank_node):
    specification_blank_node["nodes"][0]["interfaces"].append(
        {"name": "TestInterface", "direction": "inout"}
    )
    return specification_blank_node


@pytest.fixture
def specification_invalid_property_type(specification_blank_node):
    specification_blank_node["nodes"][0]["properties"].append(
        {
            "name": "TestProperty",
            "type": "InvalidType",
        }
    )
    return specification_blank_node


@pytest.fixture
def specification_invalid_property_value(specification_blank_node):
    specification_blank_node["nodes"][0]["properties"].append(
        {
            "name": "TestProperty",
            "type": "select",
            "values": "Invalid",
        }
    )
    return specification_blank_node


@pytest.fixture
def specification_nodes_without_name(specification_blank_node):
    for node in specification_blank_node["nodes"]:
        del node["name"]
    return specification_blank_node


@pytest.fixture
def specification_node_as_category_not_extending(specification_blank_node):
    specification_blank_node["nodes"][0]["isCategory"] = True
    specification_blank_node["nodes"].append(
        {"name": "Q", "category": "TestNode"}
    )
    return specification_blank_node


@pytest.fixture
def specification_node_as_category_different_category_path(
    specification_blank_node
):
    specification_blank_node["nodes"][0]["isCategory"] = True
    specification_blank_node["nodes"].append(
        {"name": "Q", "category": "c/d", "extends": ["TestNode"]},
    )
    return specification_blank_node


@pytest.fixture
def specification_same_node(specification_blank_node):
    specification_blank_node["nodes"].append(
        specification_blank_node["nodes"][0]
    )
    return specification_blank_node


@pytest.fixture
def specification_same_node_name_different_category(specification_blank_node):
    specification_blank_node["nodes"].append(
        deepcopy(specification_blank_node["nodes"][0])
    )
    specification_blank_node["nodes"][1]["category"] = "OtherCategory"
    return specification_blank_node


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
def specification_no_nodes():
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
def specification_nodes_without_properties(specification_blank_node):
    for node in specification_blank_node["nodes"]:
        del node["properties"]
    return specification_blank_node


@pytest.fixture
def specification_nodes_without_interfaces(specification_blank_node):
    for node in specification_blank_node["nodes"]:
        del node["interfaces"]
    return specification_blank_node


@pytest.fixture
def specification_nodes_without_layer(specification_blank_node):
    for node in specification_blank_node["nodes"]:
        del node["layer"]
    return specification_blank_node


@pytest.fixture
def specification_nodes_only_name_and_category(specification_blank_node):
    for node in specification_blank_node["nodes"]:
        del node["interfaces"]
        del node["properties"]
        del node["layer"]
    return specification_blank_node


@pytest.fixture
def specification_node_as_category_with_inheriting(specification_blank_node):
    specification_blank_node["nodes"][0]["isCategory"] = True
    specification_blank_node["nodes"].append(
        {"name": "ChildNode", "extends": ["TestNode"]}
    )
    return specification_blank_node


@pytest.fixture
def specification_node_as_category_with_inheriting_nested(
    specification_blank_node,
):
    specification_blank_node["nodes"][0]["isCategory"] = True
    specification_blank_node["nodes"].append(
        {
            "category": "TestNode/Double/Nested",
            "isCategory": True,
            "extends": ["TestNode"],
        }
    )
    specification_blank_node["nodes"].append(
        {"name": "Test1", "extends": ["TestNode"]}
    )
    specification_blank_node["nodes"].append(
        {"name": "Test2", "extends": ["Nested"]}
    )
    return specification_blank_node


@pytest.fixture
def specification_node_as_category_other_category_with_same_name(
    specification_blank_node,
):
    specification_blank_node["nodes"][0]["isCategory"] = True
    specification_blank_node["nodes"].append(
        {"name": "Test1", "extends": ["TestNode"]}
    )
    specification_blank_node["nodes"].append(
        {"name": "Test2", "category": "Test/TestNode"}
    )
    return specification_blank_node


# ----------------------------------
# NOTE: Specifications with graph nodes
# ----------------------------------


@pytest.fixture
def specification_with_empty_graph_node(
    specification_blank_node,
):
    specification_blank_node["graphs"] = [
        {
            "id": "78cc86c4-9ad0-4a8f-88cb-71ee28c48659",
            "nodes": [
                {
                    "name": "TestNode",
                    "id": "fc7d1706-6240-41e2-a8da-91c8577e09f9",
                    "position": {"x": 2100, "y": 200},
                    "interfaces": [],
                    "properties": [],
                }
            ],
            "connections": [],
        }
    ]
    return specification_blank_node


@pytest.fixture
def specification_with_interface_graph_node(
    specification_one_interface,
):
    specification_one_interface["graphs"] = [
        {
            "id": "78cc86c4-9ad0-4a8f-88cb-71ee28c48659",
            "nodes": [
                {
                    "name": "TestNode",
                    "id": "fc7d1706-6240-41e2-a8da-91c8577e09f9",
                    "position": {"x": 2100, "y": 200},
                    "interfaces": [
                        {
                            "direction": "inout",
                            "id": "6efb374c-a115-404e-ade8-0aa05ba93996",
                            "name": "TestInterface",
                        }
                    ],
                    "properties": [],
                }
            ],
            "connections": [],
        }
    ]
    return specification_one_interface


@pytest.fixture
def specification_with_two_interfaces_connected_graph_node(
    specification_with_interface_graph_node
):
    specification_with_interface_graph_node["graphs"][0]["nodes"].append(
        deepcopy(
            specification_with_interface_graph_node["graphs"][0]["nodes"][0]
        )
    )
    specification_with_interface_graph_node["graphs"][0]["nodes"][1][
        "id"
    ] = "d3d50788-5a85-4c1a-9bad-41257d4f2201"
    specification_with_interface_graph_node["graphs"][0]["nodes"][1][
        "interfaces"
    ][0]["id"] = "941377c0-6dce-4900-bc6c-a03603e6e8f2"
    specification_with_interface_graph_node["graphs"][0]["connections"].append(
        {
            "id": "ecaf03d7-5d57-4002-90ba-169515a47263",
            "from": "941377c0-6dce-4900-bc6c-a03603e6e8f2",
            "to": "6efb374c-a115-404e-ade8-0aa05ba93996",
        }
    )
    return specification_with_interface_graph_node


@pytest.fixture
def specification_with_invalid_connection_graph_node(
    specification_with_interface_graph_node
):
    specification_with_interface_graph_node["graphs"][0]["connections"].append(
        {
            "id": "ecaf03d7-5d57-4002-90ba-169515a47263",
            "from": "941377c0-6dce-4900-bc6c-a03603e6e8f2",
            "to": "6efb374c-a115-404e-ade8-0aa05ba93996",
        }
    )
    return specification_with_interface_graph_node


@pytest.fixture
def specification_with_missing_interface_in_graph_node(
    specification_with_interface_graph_node,
):
    specification_with_interface_graph_node["graphs"][0]["nodes"][0][
        "interfaces"
    ][0]["name"] = "NonExistingInterface"
    return specification_with_interface_graph_node


@pytest.fixture
def specification_with_invalid_interface_in_graph_node(
    specification_with_empty_graph_node,
):
    specification_with_empty_graph_node["graphs"][0]["nodes"][0][
        "interfaces"
    ].append(
        {
            "direction": "input",
            "id": "6efb374c-a115-404e-ade8-0aa05ba93996",
            "name": "frames",
        }
    )
    return specification_with_empty_graph_node


@pytest.fixture
def specification_invalid_node_in_graph_node(
    specification_with_empty_graph_node,
):
    specification_with_empty_graph_node["graphs"][0]["nodes"][0][
        "name"
    ] = "NonExistingNode"
    return specification_with_empty_graph_node


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
        "specification_nodes_without_properties",
        "specification_one_interface",
        "specification_nodes_without_interfaces",
        "specification_nodes_without_layer",
        "specification_nodes_only_name_and_category",
        "specification_node_as_category_with_inheriting",
        "specification_node_as_category_with_inheriting_nested",
        "specification_node_as_category_other_category_with_same_name",
        "specification_with_two_interfaces_connected_graph_node",
        "specification_with_empty_graph_node",
        "specification_with_interface_graph_node",
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
        "specification_no_nodes",
        "dataflow_without_nodes",
        "specification_with_invalid_connection_graph_node",
        "specification_with_missing_interface_in_graph_node",
        "specification_with_invalid_interface_in_graph_node",
        "specification_invalid_node_in_graph_node",
    ],
)
def test_invalid_specification(
    prepare_validation_environment, invalid_specification, request
):
    invalid_specification = request.getfixturevalue(invalid_specification)
    assert check_validation(invalid_specification) == 1
