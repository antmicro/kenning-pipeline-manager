# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import pytest

from pipeline_manager.tests.conftest import check_validation


@pytest.mark.parametrize(
    "specification,dataflow,expected",
    [
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
            "dataflow_specification_node_no_properties",
            "dataflow_valid_node_property_select",
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
            }
        ]
    }


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
