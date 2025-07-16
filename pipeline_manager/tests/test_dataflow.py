# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import pytest

from pipeline_manager.tests.conftest import check_validation


@pytest.mark.parametrize(
    "specification,dataflow,expected",
    [
        ("specification_without_explicit_direction", "dataflow_node_base", 0),
        (
            "specification_without_explicit_direction",
            "dataflow_employing_nodes_without_specified_direction_of_interface",
            0,
        ),
        (
            "dataflow_specification_node_no_properties",
            "dataflow_node_no_property",
            0,
        ),
        (
            "dataflow_specification_node_property_text",
            "dataflow_node_no_property",
            0,
        ),
        (
            "dataflow_specification_node_property_text",
            "dataflow_node_property_text",
            0,
        ),
        (
            "dataflow_specification_node_property_select",
            "dataflow_valid_node_property_select",
            0,
        ),
        (
            "dataflow_specification_node_property_list",
            "dataflow_node_property_list",
            0,
        ),
        (
            "dataflow_specification_node_and_graph_node_maxConnectionsCount_equal_two",
            "dataflow_two_layer_graph_interfaces_connected_graph_node",
            0,
        ),
        (
            "dataflow_specification_node_and_graph_node_maxConnectionsCount_equal_three",
            "dataflow_three_layer_graph_interfaces_connected_graph_node",
            0,
        ),
        (
            "dataflow_specification_node_no_properties",
            "dataflow_valid_node_property_select",
            2,
        ),
        (
            "dataflow_specification_node_property_list",
            "dataflow_node_property_list_dtype_mismatch",
            2,
        ),
        (
            "dataflow_specification_node_property_text",
            "dataflow_invalid_node_property_value_boolean",
            2,
        ),
        (
            "dataflow_specification_node_property_text",
            "dataflow_invalid_node_property_value_integer",
            2,
        ),
        (
            "dataflow_specification_node_property_select",
            "dataflow_invalid_node_property_select_value_text",
            2,
        ),
        (
            "dataflow_specification_node_property_select",
            "dataflow_invalid_node_property_select_value_bool",
            2,
        ),
        (
            "dataflow_specification_two_incompatible_nodes",
            "dataflow_graph_incompatible_interfaces_connected",
            2,
        ),
        (
            "dataflow_specification_incompatible_node_and_graph_node",
            "dataflow_graph_incompatible_interfaces_connected_graph_node",
            2,
        ),
        (
            "dataflow_specification_node_and_graph_node_maxConnectionsCount_equal_one",
            "dataflow_two_layer_graph_interfaces_connected_graph_node",
            2,
        ),
        (
            "dataflow_specification_node_and_graph_node_maxConnectionsCount_equal_two",
            "dataflow_three_layer_graph_interfaces_connected_graph_node",
            2,
        ),
    ],
)
def test_dataflow_expected(
    prepare_validation_environment,
    specification,
    dataflow,
    expected,
    request,
):
    specification_dict = request.getfixturevalue(specification)
    dataflow_dict = request.getfixturevalue(dataflow)
    assert check_validation(specification_dict, dataflow_dict) == expected


@pytest.fixture
def dataflow_specification_node_no_properties():
    return {
        "nodes": [
            {
                "name": "SaveVideo",
                "category": "Filesystem",
                "interfaces": [
                    {
                        "name": "frames",
                        "type": ["Image", "BinaryImage"],
                        "direction": "input",
                    }
                ],
            },
        ]
    }


@pytest.fixture
def specification_without_explicit_direction(
    dataflow_specification_node_no_properties
):
    dataflow_specification_node_no_properties["nodes"].append(
        {
            "name": "CloneVideo",
            "category": "Filesystem",
            "interfaces": [
                {
                    "name": "in_frames",
                    "type": ["Image", "BinaryImage"],
                },
                {
                    "name": "inout_frames",
                    "type": ["Image", "BinaryImage"],
                },
                {
                    "name": "out_frames",
                    "type": ["Image", "BinaryImage"],
                    "direction": "output",
                },
            ],
        }
    )
    return dataflow_specification_node_no_properties


@pytest.fixture
def dataflow_specification_node_property_text(
    dataflow_specification_node_no_properties
):
    dataflow_specification_node_no_properties["nodes"][0]["properties"] = [
        {"name": "filename", "type": "text", "default": "some-val"}
    ]
    return dataflow_specification_node_no_properties


@pytest.fixture
def dataflow_specification_node_property_select(
    dataflow_specification_node_no_properties
):
    dataflow_specification_node_no_properties["nodes"][0]["properties"] = [
        {
            "name": "encoding",
            "type": "select",
            "default": "rgb",
            "values": ["rgb", "bgr", "mono"],
        }
    ]
    return dataflow_specification_node_no_properties


@pytest.fixture
def dataflow_specification_node_property_list(
    dataflow_specification_node_no_properties
):
    dataflow_specification_node_no_properties["nodes"][0]["properties"] = [
        {
            "name": "tags",
            "type": "list",
            "dtype": "string",
            "default": [],
        }
    ]
    return dataflow_specification_node_no_properties


# ----------------------------------
# Specifications with nodes that have incompatible interfaces
# ----------------------------------


@pytest.fixture
def dataflow_specification_two_incompatible_nodes(
    dataflow_specification_node_no_properties
):
    dataflow_specification_node_no_properties["nodes"].append(
        {
            "name": "EncodeVideo",
            "category": "Filesystem",
            "interfaces": [
                {
                    "name": "External Encoding",
                    "type": ["Text"],
                    "direction": "inout",
                }
            ],
        }
    )
    return dataflow_specification_node_no_properties


@pytest.fixture
def dataflow_specification_incompatible_node_and_graph_node(
    dataflow_specification_two_incompatible_nodes
):
    dataflow_specification_two_incompatible_nodes["nodes"].append(
        {
            "name": "Subgraph node #1",
            "category": "Subgraph node #1",
            "subgraphId": "34ef2575-77dd-46de-917c-cfcdbd40d4eb",
            "interfaces": [],
        }
    )
    dataflow_specification_two_incompatible_nodes["graphs"] = []
    dataflow_specification_two_incompatible_nodes["graphs"].append(
        {
            "name": "Subgraph #1",
            "id": "34ef2575-77dd-46de-917c-cfcdbd40d4eb",
            "nodes": [
                {
                    "name": "EncodeVideo",
                    "interfaces": [
                        {
                            "id": "40adf4d9-bf08-40ee-82f3-c95b4588dc32",
                            "name": "External Encoding",
                            "externalName": "External Encoding",
                            "direction": "inout",
                        }
                    ],
                    "position": {"x": 600, "y": 500},
                    "twoColumn": False,
                    "properties": [],
                }
            ],
            "connections": [],
        },
    )
    return dataflow_specification_two_incompatible_nodes


def set_connections_count_del_type(spec, count):
    for node in spec["nodes"]:
        for interface in node["interfaces"]:
            del interface["type"]
            interface["maxConnectionsCount"] = count
    return spec


@pytest.fixture
def dataflow_specification_node_and_graph_node_maxConnectionsCount_equal_one(
    dataflow_specification_incompatible_node_and_graph_node
):
    return set_connections_count_del_type(
        dataflow_specification_incompatible_node_and_graph_node, 1
    )


@pytest.fixture
def dataflow_specification_node_and_graph_node_maxConnectionsCount_equal_two(
    dataflow_specification_incompatible_node_and_graph_node
):
    return set_connections_count_del_type(
        dataflow_specification_incompatible_node_and_graph_node, 2
    )


@pytest.fixture
def dataflow_specification_node_and_graph_node_maxConnectionsCount_equal_three(
    dataflow_specification_incompatible_node_and_graph_node
):
    return set_connections_count_del_type(
        dataflow_specification_incompatible_node_and_graph_node, 3
    )


# ----------------------------------
# Dataflows with different properties
# ----------------------------------


@pytest.fixture
def dataflow_node_base():
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
                        "properties": [],
                        "twoColumn": True,
                    }
                ],
            }
        ]
    }


@pytest.fixture
def dataflow_node_no_property(dataflow_node_base):
    return dataflow_node_base


@pytest.fixture
def dataflow_node_property_text(dataflow_node_base):
    dataflow_node_base["graphs"][0]["nodes"][0]["properties"].append(
        {
            "id": "3039e744-9941-47c5-8902-f260e6c29a35",
            "name": "filename",
            "value": "/some/file/path",
        }
    )
    return dataflow_node_base


@pytest.fixture
def dataflow_node_property_list(dataflow_node_base):
    dataflow_node_base["graphs"][0]["nodes"][0]["properties"].append(
        {
            "id": "3039e744-9941-47c5-8902-f260e6c29a35",
            "name": "tags",
            "value": ["a", "b"],
        }
    )
    return dataflow_node_base


@pytest.fixture
def dataflow_node_property_list_dtype_mismatch(dataflow_node_base):
    dataflow_node_base["graphs"][0]["nodes"][0]["properties"].append(
        {
            "id": "3039e744-9941-47c5-8902-f260e6c29a35",
            "name": "tags",
            "value": ["a", 3],
        }
    )
    return dataflow_node_base


@pytest.fixture
def dataflow_invalid_node_property_value_boolean(dataflow_node_property_text):
    dataflow_node_property_text["graphs"][0]["nodes"][0]["properties"][0][
        "value"
    ] = True
    return dataflow_node_property_text


@pytest.fixture
def dataflow_invalid_node_property_value_integer(dataflow_node_property_text):
    dataflow_node_property_text["graphs"][0]["nodes"][0]["properties"][0][
        "value"
    ] = 888
    return dataflow_node_property_text


@pytest.fixture
def dataflow_valid_node_property_select(dataflow_node_base):
    dataflow_node_base["graphs"][0]["nodes"][0]["properties"].append(
        {
            "id": "3039e744-9941-47c5-8902-f260e6c29a35",
            "name": "encoding",
            "value": "bgr",
        }
    )
    return dataflow_node_base


@pytest.fixture
def dataflow_invalid_node_property_select_value_text(
    dataflow_valid_node_property_select
):
    dataflow_valid_node_property_select["graphs"][0]["nodes"][0]["properties"][
        0
    ]["value"] = "option-doesnt-exist"
    return dataflow_valid_node_property_select


@pytest.fixture
def dataflow_invalid_node_property_select_value_bool(
    dataflow_valid_node_property_select
):
    dataflow_valid_node_property_select["graphs"][0]["nodes"][0]["properties"][
        0
    ]["value"] = False
    return dataflow_valid_node_property_select


# ----------------------------------
# Dataflows with incompatible interfaces connected
# ----------------------------------


@pytest.fixture
def dataflow_graph_incompatible_interfaces_connected(
    dataflow_node_base,
):
    dataflow_node_base["graphs"][0]["nodes"].append(
        {
            "name": "EncodeVideo",
            "id": "a35f5cab-b374-45f0-abe2-15549714e48f",
            "position": {"x": 2100, "y": 200},
            "interfaces": [
                {
                    "direction": "inout",
                    "id": "8de940b5-6076-485c-844d-93227281b5e3",
                    "name": "External Encoding",
                }
            ],
            "properties": [],
            "twoColumn": True,
        }
    )
    dataflow_node_base["graphs"][0]["connections"].append(
        {
            "id": "4b1a3e86-7c0b-411c-a580-b0a4c9fd2582",
            "from": "8de940b5-6076-485c-844d-93227281b5e3",
            "to": "6efb374c-a115-404e-ade8-0aa05ba93996",
        }
    )
    return dataflow_node_base


@pytest.fixture
def dataflow_graph_incompatible_interfaces_connected_graph_node(
    dataflow_node_base,
):
    dataflow_node_base["graphs"].append(
        {
            "id": "7060fa38-a0fe-4e44-8e5a-de5a2187680f",
            "nodes": [
                {
                    "name": "EncodeVideo",
                    "id": "231d20d8-811b-46e8-ba9a-6342032f6c85",
                    "interfaces": [
                        {
                            "name": "External Encoding",
                            "externalName": "External Encoding",
                            "id": "6ba91cca-80d5-4598-a6ab-750ddb6cec83",
                            "direction": "inout",
                        }
                    ],
                    "position": {"x": 600, "y": 500},
                    "twoColumn": False,
                    "properties": [],
                }
            ],
            "connections": [],
        }
    )
    dataflow_node_base["graphs"][0]["nodes"].append(
        {
            "name": "Subgraph node #1",
            "id": "afe19cad-a7fd-465e-a05a-0b46ece51941",
            "interfaces": [
                {
                    "name": "External Encoding",
                    "id": "6ba91cca-80d5-4598-a6ab-750ddb6cec83",
                    "direction": "inout",
                }
            ],
            "position": {"x": 500, "y": 200},
            "subgraph": "7060fa38-a0fe-4e44-8e5a-de5a2187680f",
            "twoColumn": False,
        }
    )
    dataflow_node_base["graphs"][0]["connections"].append(
        {
            "id": "4b1a3e86-7c0b-411c-a580-b0a4c9fd2582",
            "from": "6ba91cca-80d5-4598-a6ab-750ddb6cec83",
            "to": "6efb374c-a115-404e-ade8-0aa05ba93996",
        }
    )
    return dataflow_node_base


@pytest.fixture
def dataflow_two_layer_graph_interfaces_connected_graph_node(
    dataflow_node_base,
):
    dataflow_node_base["graphs"].append(
        {
            "id": "7060fa38-a0fe-4e44-8e5a-de5a2187680f",
            "nodes": [
                {
                    "name": "EncodeVideo",
                    "id": "231d20d8-811b-46e8-ba9a-6342032f6c85",
                    "interfaces": [
                        {
                            "name": "External Encoding",
                            "externalName": "External Encoding",
                            "id": "6ba91cca-80d5-4598-a6ab-750ddb6cec83",
                            "direction": "inout",
                        }
                    ],
                    "position": {"x": 600, "y": 500},
                    "twoColumn": False,
                    "properties": [],
                },
                {
                    "name": "EncodeVideo",
                    "id": "8e81c0ff-0625-4720-8f6e-322a167ab283",
                    "interfaces": [
                        {
                            "name": "External Encoding",
                            "id": "51cdbbf8-e78c-4e75-99df-5b841c45d4a3",
                            "direction": "inout",
                        }
                    ],
                    "position": {"x": 600, "y": 500},
                    "twoColumn": False,
                    "properties": [],
                },
            ],
            "connections": [
                {
                    "id": "5e03deef-7a6d-4b1b-b0ca-a75b6f1dea25",
                    "from": "6ba91cca-80d5-4598-a6ab-750ddb6cec83",
                    "to": "51cdbbf8-e78c-4e75-99df-5b841c45d4a3",
                }
            ],
        }
    )
    dataflow_node_base["graphs"][0]["nodes"].append(
        {
            "name": "Subgraph node #1",
            "id": "afe19cad-a7fd-465e-a05a-0b46ece51941",
            "interfaces": [
                {
                    "name": "External Encoding",
                    "externalName": "External Encoding",
                    "id": "6ba91cca-80d5-4598-a6ab-750ddb6cec83",
                    "direction": "inout",
                }
            ],
            "position": {"x": 500, "y": 200},
            "subgraph": "7060fa38-a0fe-4e44-8e5a-de5a2187680f",
            "twoColumn": False,
        }
    )
    dataflow_node_base["graphs"][0]["connections"].append(
        {
            "id": "4b1a3e86-7c0b-411c-a580-b0a4c9fd2582",
            "from": "6ba91cca-80d5-4598-a6ab-750ddb6cec83",
            "to": "6efb374c-a115-404e-ade8-0aa05ba93996",
        }
    )
    return dataflow_node_base


# ----------------------------------
# Dataflows with multi-layer graphs
# ----------------------------------


@pytest.fixture
def dataflow_three_layer_graph_interfaces_connected_graph_node(
    dataflow_two_layer_graph_interfaces_connected_graph_node
):
    dataflow_two_layer_graph_interfaces_connected_graph_node["graphs"].append(
        {
            "id": "9c4d5349-9d3b-401f-86bb-021b7b3e5b81",
            "nodes": [
                {
                    "id": "4f3be893-1212-4820-8e5d-cb85535083d7",
                    "position": {"x": 500, "y": 0},
                    "interfaces": [
                        {
                            "name": "External Encoding",
                            "id": "6ba91cca-80d5-4598-a6ab-750ddb6cec83",
                            "direction": "inout",
                        }
                    ],
                    "subgraph": "78cc86c4-9ad0-4a8f-88cb-71ee28c48659",
                    "name": "Subgraph node #1",
                },
                {
                    "id": "9dcc9b2b-2933-467b-9d14-f16e355f0323",
                    "position": {"x": 500, "y": 600},
                    "interfaces": [
                        {
                            "name": "External Encoding",
                            "id": "9ae8e27c-7556-4599-8e93-0dd632399eff",
                            "direction": "inout",
                        }
                    ],
                    "name": "EncodeVideo",
                },
            ],
            "connections": [
                {
                    "id": "b0832022-c1c4-4c69-a1c2-07d328370faa",
                    "from": "6ba91cca-80d5-4598-a6ab-750ddb6cec83",
                    "to": "9ae8e27c-7556-4599-8e93-0dd632399eff",
                }
            ],
        }
    )
    return dataflow_two_layer_graph_interfaces_connected_graph_node


@pytest.fixture
def dataflow_employing_nodes_without_specified_direction_of_interface(
    dataflow_node_base
):
    """
    Test if placing a component, without explicitly provided direction
    in specification, gets parsed correctly.
    """
    dataflow_node_base["graphs"][0]["nodes"].append(
        {
            "name": "CloneVideo",
            "id": "fc7d1706-6200-997a-a8da-91c8577e0955",
            "position": {"x": 1000, "y": 200},
            "interfaces": [
                {
                    "direction": "inout",
                    "id": "64fba0ab-a115-404e-ade8-0aa05ba93992",
                    "name": "inout_frames",
                    "side": "right",
                    "sidePosition": 1,
                },
            ],
            "properties": [],
            "twoColumn": True,
        }
    )

    return dataflow_node_base
