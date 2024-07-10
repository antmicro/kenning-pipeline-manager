# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import pytest
from pytest_httpserver import HTTPServer

from pipeline_manager.tests.conftest import check_validation, example_pairs


@pytest.fixture
def specification_no_include():
    return {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "extends": ["B"]},
            {"name": "Z", "category": "c/B"},
        ],
    }


@pytest.fixture
def dataflow_one_graph():
    return {
        "graphs": [
            {
                "name": "SaveVideo",
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
                                "name": "encoding",
                                "value": "bgr",
                            }
                        ],
                        "twoColumn": True,
                    }
                ],
            }
        ]
    }


@pytest.fixture
def specification_SaveVideo_node():
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
                "properties": [
                    {
                        "name": "encoding",
                        "type": "select",
                        "default": "rgb",
                        "values": ["rgb", "bgr", "mono"],
                    }
                ],
            }
        ],
    }


@pytest.fixture
def specification_empty_include(specification_no_include):
    specification_no_include["include"] = []
    return specification_no_include


@pytest.fixture
def specification_empty_include_graphs(specification_no_include):
    specification_no_include["includeGraphs"] = []
    return specification_no_include


@pytest.fixture
def specification_include_doesnt_exist(specification_no_include):
    specification_no_include["include"] = [
        "http://localhost:1234/this-does-not-exist/specification.json",
    ]
    return specification_no_include


@pytest.fixture
def specification_include_graphs_doesnt_exist(specification_no_include):
    specification_no_include["includeGraphs"] = [
        {
            "url": "http://localhost:1234/this-does-not-exist/dataflow.json",  # noqa: E501
        }
    ]
    return specification_no_include


@pytest.fixture
def specification_include_graph_empty(
    specification_no_include, httpserver: HTTPServer
):
    httpserver.expect_request("/dataflow.json").respond_with_json({})
    specification_no_include["includeGraphs"] = [
        {
            "url": httpserver.url_for("/dataflow.json"),
        }
    ]
    return specification_no_include


@pytest.fixture
def specification_recursive_include(
    specification_no_include, httpserver: HTTPServer
):
    specification_no_include["include"] = [
        httpserver.url_for("/specification.json")
    ]

    httpserver.expect_request("/specification.json").respond_with_json(
        specification_no_include
    )

    return {
        "include": [
            httpserver.url_for("/specification.json"),
        ],
    }


@pytest.fixture
def specification_repeating_node_declarations(
    specification_no_include, httpserver: HTTPServer
):
    httpserver.expect_request("/specification.json").respond_with_json(
        specification_no_include
    )
    httpserver.expect_request("/second-specification.json").respond_with_json(
        specification_no_include
    )

    return {
        "include": [
            httpserver.url_for("/specification.json"),
            httpserver.url_for("/second-specification.json"),
        ],
    }


@pytest.fixture
def specification_nodes_in_include(
    specification_no_include, httpserver: HTTPServer
):
    httpserver.expect_request("/specification.json").respond_with_json(
        specification_no_include
    )

    return {
        "include": [
            httpserver.url_for("/specification.json"),
        ],
    }


@pytest.fixture
def specification_repeating_include(
    specification_no_include, httpserver: HTTPServer
):
    httpserver.expect_request("/specification.json").respond_with_json(
        specification_no_include
    )

    # We expect warning here instead of an error
    return {
        "include": [
            httpserver.url_for("/specification.json"),
            httpserver.url_for("/specification.json"),
        ],
    }


@pytest.fixture
def specification_nested_repeating_include(
    specification_no_include, httpserver: HTTPServer
):
    second_specification = {
        "include": [httpserver.url_for("/specification.json")],
    }

    httpserver.expect_request("/specification.json").respond_with_json(
        specification_no_include
    )
    httpserver.expect_request("/second-specification.json").respond_with_json(
        second_specification
    )
    # We expect skip of the nested `/specification.json` loading
    return {
        "include": [
            httpserver.url_for("/specification.json"),
            httpserver.url_for("/second-specification.json"),
        ],
    }


@pytest.fixture
def specification_include_graphs_node_conflicting(
    specification_SaveVideo_node, dataflow_one_graph, httpserver: HTTPServer
):
    httpserver.expect_request("/dataflow.json").respond_with_json(
        dataflow_one_graph
    )

    specification_SaveVideo_node["includeGraphs"] = [
        {
            "url": httpserver.url_for("/dataflow.json"),
            "category": "includeGraphs",
            "name": "SaveVideo",
        }
    ]

    return specification_SaveVideo_node


@pytest.fixture
def specification_include_graphs_names_repeated(
    specification_SaveVideo_node, dataflow_one_graph, httpserver: HTTPServer
):
    httpserver.expect_request("/dataflow.json").respond_with_json(
        dataflow_one_graph
    )
    specification_SaveVideo_node["includeGraphs"] = [
        {
            "url": httpserver.url_for("/dataflow.json"),
            "category": "includeGraphs",
            "name": "LoadVideo",
        },
        {
            "url": httpserver.url_for("/dataflow.json"),
            "category": "includeGraphs",
            "name": "LoadVideo",
        },
    ]
    return specification_SaveVideo_node


@pytest.fixture
def specification_include_graphs_no_nodes(
    specification_SaveVideo_node, httpserver: HTTPServer
):
    dataflow_specification = {
        "graphs": [
            {
                "name": "GraphName",
                "connections": [],
                "id": "78cc86c4-9ad0-4a8f-88cb-71ee28c48659",
                "nodes": [
                    {
                        "name": "ThisNodeDoesNotExist",
                        "category": "someCategory",
                        "interfaces": [],
                        "properties": [],
                    }
                ],
            }
        ]
    }

    httpserver.expect_request("/dataflow.json").respond_with_json(
        dataflow_specification
    )

    specification_SaveVideo_node["includeGraphs"] = [
        {
            "url": httpserver.url_for("/dataflow.json"),
            "category": "includeGraphs",
            "name": "LoadVideo",
        },
    ]
    return specification_SaveVideo_node


@pytest.mark.parametrize(
    "specification,expected",
    [
        ("specification_no_include", 0),
        ("specification_SaveVideo_node", 0),
        ("specification_empty_include", 0),
        ("specification_empty_include_graphs", 0),
        ("specification_include_doesnt_exist", 1),
        ("specification_include_graphs_doesnt_exist", 1),
        ("specification_include_graph_empty", 1),
        ("specification_recursive_include", 1),
        ("specification_repeating_node_declarations", 1),
        ("specification_nodes_in_include", 0),
        ("specification_repeating_include", 1),
        ("specification_nested_repeating_include", 0),
        ("specification_include_graphs_node_conflicting", 1),
        ("specification_include_graphs_names_repeated", 1),
        ("specification_include_graphs_no_nodes", 1),
    ],
)
def test_valid_specification(specification, expected, request):
    specification = request.getfixturevalue(specification)
    assert check_validation(specification) == expected


@pytest.mark.parametrize("example", example_pairs())
def test_all_existing_examples_by_include(example, httpserver: HTTPServer):
    """
    Tests all existing pairs of specification and dataflow files in
    examples module. It is assumed that each pair is in format
    (*-specification.json, *-dataflow.json).

    It included the dataflow as `includeGraphs` in the specification.
    """
    import json

    spec, dataflow = example

    with open(spec) as spec, open(dataflow) as dataflow:
        spec = json.load(spec)
        dataflow = json.load(dataflow)

    if len(dataflow["graphs"]) > 1:
        pytest.xfail("Only single graph dataflows are supported.")

    httpserver.expect_request("/dataflow.json").respond_with_json(dataflow)

    spec["includeGraphs"] = [
        {
            "url": httpserver.url_for("/dataflow.json"),
            "category": "includeGraphs",
            "name": "Dataflow",
        },
    ]

    assert check_validation(spec) == 0
