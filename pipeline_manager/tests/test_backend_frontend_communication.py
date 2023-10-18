# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import multiprocessing
from http import HTTPStatus
import json
from typing import Any, NamedTuple, List
import time

import pytest

from pipeline_manager_backend_communication.misc_structures import (
    MessageType,
)  # noqa: E501
from pipeline_manager.utils.mock_application import MockApplicationClient
from pipeline_manager.backend.state_manager import global_state_manager
from pipeline_manager.backend.socketio import create_socketio


@pytest.fixture
def app_client():
    socketio, app = create_socketio()
    app.testing = True
    return socketio.test_client(app)


@pytest.fixture
def application_client(sample_specification, sample_dataflow):
    application_client = MockApplicationClient(
        "127.0.0.1", 12312, sample_specification, sample_dataflow
    )
    yield application_client
    application_client.disconnect()


# Requests Fixtures
# ---------------
class SingleRequest(NamedTuple):
    """
    NamedTuple used to create fixtures that represent single socketio request.

    Parameters
    ----------
    name : str
        Event that is being tested.
    expected_status : HTTPStatus
        Expected HTTP code of the response.
    expected_data : Any
        Expected data of the response. If None then it is not checked.
    arguments : List[Any]
        List of arguments that should be emitted.
    """

    name: str
    expected_status: HTTPStatus
    expected_data: Any = None
    arguments: List[Any] = []


@pytest.fixture
def connect_success():
    return SingleRequest(
        "external_app_connect", HTTPStatus.OK, "External application connected"
    )


@pytest.fixture
def request_specification_success():
    return SingleRequest("request_specification", HTTPStatus.OK)


@pytest.fixture
def request_specification_unavailable():
    return SingleRequest(
        "request_specification",
        HTTPStatus.SERVICE_UNAVAILABLE,
        "External application is disconnected",
    )


@pytest.fixture
def dataflow_run(sample_dataflow):
    return SingleRequest(
        "dataflow_action_request",
        HTTPStatus.OK,
        {"content": "Run was successful", "type": MessageType.OK.value},
        ["run", json.dumps(sample_dataflow)],
    )


@pytest.fixture
def dataflow_validate(sample_dataflow):
    return SingleRequest(
        "dataflow_action_request",
        HTTPStatus.OK,
        {"content": "Validation was successful", "type": MessageType.OK.value},
        ["validate", json.dumps(sample_dataflow)],
    )


@pytest.fixture
def dataflow_export(sample_dataflow):
    return SingleRequest(
        "dataflow_action_request",
        HTTPStatus.OK,
        {"content": "Export was successful", "type": MessageType.OK.value},
        ["export", json.dumps(sample_dataflow)],
    )


@pytest.fixture
def dataflow_import(sample_dataflow):
    return SingleRequest(
        "dataflow_action_request",
        HTTPStatus.OK,
        None,
        ["import", json.dumps(sample_dataflow)],
    )


@pytest.fixture
def get_status_connected():
    return SingleRequest(
        "get_status", HTTPStatus.OK, "External application connected"
    )


@pytest.fixture
def get_status_disconnected():
    return SingleRequest(
        "get_status",
        HTTPStatus.SERVICE_UNAVAILABLE,
        "External application disconnected",
    )


# ---------------


# Multi-request tests
# ---------------
def test_connecting_multiple_times(
    app_client,
    application_client,
    sample_specification,
    connect_success,
    request_specification_success,
    request_specification_unavailable,
    get_status_connected,
    get_status_disconnected,
):
    """
    Test a scenario where a client connects, disconnects
    and then connects once again.
    """
    events = [
        connect_success,
        get_status_disconnected,
        request_specification_unavailable,
        connect_success,
        get_status_connected,
        request_specification_success,
    ]

    def connect_and_request(app_client, responses):
        global_state_manager.reinitialize(
            application_client.port, application_client.host
        )

        for event in events:
            response = app_client.emit(
                event.name, *event.arguments, callback=True
            )
            responses.append(response)

    responses = (multiprocessing.Manager()).list()
    process = multiprocessing.Process(
        target=connect_and_request, args=(app_client, responses)
    )
    process.start()

    application_client.try_connecting()
    application_client.disconnect()
    time.sleep(1)
    application_client.try_connecting()
    application_client.answer_valid()

    process.join()

    for event, response in zip(events, responses):
        status_code = response["status"]
        data = response["data"]

        assert status_code == event.expected_status
        if event.expected_data is not None:
            assert event.expected_data == data

    status = responses[-1]["status"]
    data = responses[-1]["data"]

    assert (
        data["content"] == sample_specification
        and MessageType.OK.value == data["type"]
        and HTTPStatus.OK == status
    )


@pytest.mark.parametrize(
    "single_event",
    [
        "request_specification_success",
        "dataflow_run",
        "dataflow_validate",
        "dataflow_export",
        "dataflow_import",
    ],
)
def test_single_event_connected_valid(
    app_client, application_client, connect_success, single_event, request
):
    """
    Tests a scenario with a single request to an name after connecting
    with the external application.

    It creates two asynchronous processes, one for the backend and one for the
    external application.

    The expected behaviour is described by `single_event` fixture.
    """
    single_event = request.getfixturevalue(single_event)

    def connect_and_request(app_client, responses):
        global_state_manager.reinitialize(
            application_client.port, application_client.host
        )

        for event in [connect_success, single_event]:
            response = app_client.emit(
                event.name, *event.arguments, callback=True
            )
            responses.append(response)

    responses = (multiprocessing.Manager()).list()
    process = multiprocessing.Process(
        target=connect_and_request, args=(app_client, responses)
    )
    process.start()

    application_client.try_connecting()
    application_client.answer_valid()

    process.join()

    status = responses[0]["status"]
    data = responses[0]["data"]
    assert (
        connect_success.expected_data == data
        and connect_success.expected_status == status
    )

    status = responses[1]["status"]
    data = responses[1]["data"]
    assert status == single_event.expected_status
    if single_event.expected_data is not None:
        assert single_event.expected_data == data


# ---------------


# get_status
# ---------------
def test_get_status_disconnected(app_client):
    response = app_client.emit("get_status", callback=True)
    assert (
        "External application disconnected" == response["data"]
        and response["status"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


# ---------------


# request_specification
# ---------------
def test_request_specification_disconnected(app_client):
    response = app_client.emit("request_specification", callback=True)
    assert (
        "External application is disconnected" == response["data"]
        and response["status"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


# dataflow_action_request
# ---------------
def test_run_dataflow_request_disconnected(app_client):
    response = app_client.emit(
        "dataflow_action_request", "run", None, callback=True
    )
    assert (
        "External application is disconnected" == response["data"]
        and response["status"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


def test_validate_dataflow_request_disconnected(app_client):
    response = app_client.emit(
        "dataflow_action_request", "validate", None, callback=True
    )
    assert (
        "External application is disconnected" == response["data"]
        and response["status"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


def test_export_dataflow_request_disconnected(app_client):
    response = app_client.emit(
        "dataflow_action_request", "export", None, callback=True
    )
    assert (
        "External application is disconnected" == response["data"]
        and response["status"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


# ---------------
