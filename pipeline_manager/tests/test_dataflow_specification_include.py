# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import pytest
from pytest_httpserver import HTTPServer

from pipeline_manager.tests.conftest import check_validation


@pytest.fixture
def specification_valid_empty_include():
    return {"include": [], "nodes": [{"name": "Q", "category": "Q"}]}


@pytest.fixture
def specification_valid_empty_include_subgraph():
    return {"includeGraphs": [], "nodes": [{"name": "Q", "category": "Q"}]}


@pytest.fixture
def specification_invalid_include_doesnt_exist():
    return {
        "include": [
            "http://localhost:1234/this-does-not-exist/specification.json",
        ],
    }


@pytest.fixture
def specification_invalid_include_subgraph_doesnt_exist():
    return {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "extends": ["B"]},
            {"name": "Z", "category": "c/B"},
        ],
        "includeGraphs": [
            {
                "url": "http://localhost:1234/this-does-not-exist/dataflow.json",  # noqa: E501
            }
        ],
    }


@pytest.fixture
def specification_invalid_include_subgraph_empty(httpserver: HTTPServer):
    httpserver.expect_request("/dataflow.json").respond_with_json({})
    return {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "extends": ["B"]},
            {"name": "Z", "category": "c/B"},
        ],
        "includeGraphs": [
            {
                "url": httpserver.url_for("/dataflow.json"),
            }
        ],
    }


@pytest.fixture
def specification_invalid_recursive_include(httpserver: HTTPServer):
    include_specification = {
        "include": [httpserver.url_for("/specification.json")],
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "extends": ["B"]},
            {"name": "Z", "category": "c/B"},
        ],
    }

    httpserver.expect_request("/specification.json").respond_with_json(
        include_specification
    )

    return {
        "include": [
            httpserver.url_for("/specification.json"),
        ],
    }


@pytest.fixture
def specification_invalid_repeating_node_declarations(httpserver: HTTPServer):
    include_specification = {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "extends": ["B"]},
            {"name": "Z", "category": "c/B"},
        ]
    }

    httpserver.expect_request("/specification.json").respond_with_json(
        include_specification
    )
    httpserver.expect_request("/second-specification.json").respond_with_json(
        include_specification
    )

    return {
        "include": [
            httpserver.url_for("/specification.json"),
            httpserver.url_for("/second-specification.json"),
        ],
    }


@pytest.fixture
def specification_valid_nodes_in_include(httpserver: HTTPServer):
    include_specification = {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "extends": ["B"]},
            {"name": "Z", "category": "c/B"},
        ]
    }

    httpserver.expect_request("/specification.json").respond_with_json(
        include_specification
    )

    return {
        "include": [
            httpserver.url_for("/specification.json"),
        ],
    }


@pytest.fixture
def specification_invalid_repeating_include(httpserver: HTTPServer):
    include_specification = {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "extends": ["B"]},
            {"name": "Z", "category": "c/B"},
        ]
    }

    httpserver.expect_request("/specification.json").respond_with_json(
        include_specification
    )

    # We expect warning here instead of an error
    return {
        "include": [
            httpserver.url_for("/specification.json"),
            httpserver.url_for("/specification.json"),
        ],
    }


@pytest.fixture
def specification_valid_nested_repeating_include(httpserver: HTTPServer):
    include_specification = {
        "nodes": [
            {"category": "a/B", "isCategory": True},
            {"name": "Q", "extends": ["B"]},
            {"name": "Z", "category": "c/B"},
        ]
    }

    second_specification = {
        "include": [httpserver.url_for("/specification.json")],
    }

    httpserver.expect_request("/specification.json").respond_with_json(
        include_specification
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
def specification_valid_include_subgraph(httpserver: HTTPServer):
    dataflow_specification = {
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

    httpserver.expect_request("/dataflow.json").respond_with_json(
        dataflow_specification
    )

    return {
        "includeGraphs": [
            {
                "url": httpserver.url_for("/dataflow.json"),
                "category": "includeGraphs",
                "name": "SaveVideo",
            },
            {
                "url": httpserver.url_for("/dataflow.json"),
                "category": "includeGraphs",
                "name": "SaveVideo2",
            },
        ],
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
def specification_invalid_include_subgraph_repeated(httpserver: HTTPServer):
    dataflow_specification = {
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

    httpserver.expect_request("/dataflow.json").respond_with_json(
        dataflow_specification
    )

    return {
        "includeGraphs": [
            {
                "url": httpserver.url_for("/dataflow.json"),
                "category": "includeGraphs",
                "name": "SaveVideo",
            },
            {
                "url": httpserver.url_for("/dataflow.json"),
                "category": "includeGraphs",
                "name": "SaveVideo",
            },
        ],
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
def specification_valid_include_subgraph_no_nodes(httpserver: HTTPServer):
    dataflow_specification = {
        "graphs": [
            {
                "name": "Empty",
                "connections": [],
                "id": "78cc86c4-9ad0-4a8f-88cb-71ee28c48659",
                "nodes": [],
            }
        ]
    }

    httpserver.expect_request("/dataflow.json").respond_with_json(
        dataflow_specification
    )

    return {
        "includeGraphs": [
            {
                "url": httpserver.url_for("/dataflow.json"),
                "category": "includeGraphs",
                "name": "SaveVideo",
            },
        ],
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


@pytest.mark.parametrize(
    "valid_specification",
    [
        "specification_valid_empty_include",
        "specification_valid_empty_include_subgraph",
        "specification_valid_include_subgraph",
        "specification_valid_include_subgraph_no_nodes",
        "specification_valid_nested_repeating_include",
        "specification_valid_nodes_in_include",
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
        "specification_invalid_include_doesnt_exist",
        "specification_invalid_include_subgraph_doesnt_exist",
        "specification_invalid_include_subgraph_empty",
        "specification_invalid_include_subgraph_repeated",
        "specification_invalid_recursive_include",
        "specification_invalid_repeating_include",
        "specification_invalid_repeating_node_declarations",
    ],
)
def test_invalid_specification(
    prepare_validation_environment, invalid_specification, request
):
    invalid_specification = request.getfixturevalue(invalid_specification)
    assert check_validation(invalid_specification) == 1
