# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import pytest
from pytest_httpserver import HTTPServer

from pipeline_manager.tests.conftest import check_validation


@pytest.fixture
def specification_invalid_empty_include():
    return {"include": []}


@pytest.fixture
def specification_invalid_include_doesnt_exist():
    return {
        "include": [
            "http://localhost:1234/this-does-not-exist/specification.json",
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


@pytest.mark.parametrize(
    "valid_specification",
    [
        "specification_valid_nodes_in_include",
        "specification_valid_nested_repeating_include",
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
        "specification_invalid_empty_include",
        "specification_invalid_repeating_include",
        "specification_invalid_include_doesnt_exist",
        "specification_invalid_recursive_include",
        "specification_invalid_repeating_node_declarations",
    ],
)
def test_invalid_specification(
    prepare_validation_environment, invalid_specification, request
):
    invalid_specification = request.getfixturevalue(invalid_specification)
    assert check_validation(invalid_specification) == 1
