# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import threading
from http import HTTPStatus
from typing import NamedTuple, Dict
from jsonrpc.jsonrpc2 import JSONRPC20Request, JSONRPC20Response
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
    expected_data : JSONRPC20Response
        Expected data of the response. If None then it is not checked.
    arguments : JSONRPC20Request
        List of arguments that should be emitted.
    """

    name: str
    expected_data: JSONRPC20Response
    arguments: JSONRPC20Request


@pytest.fixture
def connect_success():
    return SingleRequest(
        "backend-api",
        JSONRPC20Response(_id=1, result={}),
        JSONRPC20Request(_id=1, method='external_app_connect')
    )


@pytest.fixture
def request_specification_success(sample_specification):
    return SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=1, result={
                'type': MessageType.OK.value,
                'content': sample_specification,
            },
        ),
        JSONRPC20Request(_id=1, method='request_specification')
    )


@pytest.fixture
def request_specification_unavailable():
    return SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=1,
            error={
                'code': HTTPStatus.SERVICE_UNAVAILABLE.value,
                'message': 'External application is disconnected'
            }
        ),
        JSONRPC20Request(_id=1, method='request_specification')
    )


@pytest.fixture
def dataflow_run(sample_dataflow):
    return SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=1, result={'type': MessageType.OK.value},
        ),
        JSONRPC20Request(
            _id=1,
            method='run_dataflow',
            params={'dataflow': sample_dataflow},
        )
    )


@pytest.fixture
def dataflow_validate(sample_dataflow):
    return SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=1, result={'type': MessageType.OK.value},
        ),
        JSONRPC20Request(
            _id=1,
            method='validate_dataflow',
            params={'dataflow': sample_dataflow},
        )
    )


@pytest.fixture
def dataflow_export(sample_dataflow):
    return SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=1, result={'type': MessageType.OK.value},
        ),
        JSONRPC20Request(
            _id=1,
            method='export_dataflow',
            params={'dataflow': sample_dataflow},
        )
    )


@pytest.fixture
def dataflow_import(sample_dataflow, sample_specification):
    return SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=1, result={
                'type': MessageType.OK.value,
                'content': sample_specification,
            },
        ),
        JSONRPC20Request(
            _id=1,
            method='import_dataflow',
            params={'external_application_dataflow': sample_dataflow},
        )
    )


@pytest.fixture
def get_status_connected():
    return SingleRequest(
        "backend-api",
        JSONRPC20Response(_id=1, result={'status': {'connected': True}}),
        JSONRPC20Request(_id=1, method='get_status')
    )


@pytest.fixture
def get_status_disconnected():
    return SingleRequest(
        "backend-api",
        JSONRPC20Response(_id=1, result={'status': {'connected': False}}),
        JSONRPC20Request(_id=1, method='get_status')
    )


def emit_request(request: SingleRequest, app_client) -> Dict:
    app_client.emit(request.name, request.arguments.data, callback=True)
    while True:
        messages = app_client.get_received()
        if messages:
            return messages[-1]['args'][0]
        time.sleep(0.1)


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

        for _, event in enumerate(events):
            responses.append(emit_request(event, app_client))
            time.sleep(0.1)

    responses = []
    process = threading.Thread(
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
        assert event.expected_data.data == response


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
            responses.append(emit_request(event, app_client))

    responses = []
    process = threading.Thread(
        target=connect_and_request, args=(app_client, responses)
    )
    process.start()

    application_client.try_connecting()
    application_client.answer_valid()

    process.join()

    data = responses[0]
    assert connect_success.expected_data.data == data

    data = responses[1]
    assert single_event.expected_data.data == data


# ---------------


# get_status
# ---------------
def test_get_status_disconnected(app_client, get_status_disconnected):
    response = emit_request(get_status_disconnected, app_client)
    assert response == get_status_disconnected.expected_data.data


# ---------------


# request_specification
# ---------------
def test_request_specification_disconnected(
    app_client,
    request_specification_unavailable,
):
    response = emit_request(request_specification_unavailable, app_client)
    assert response == request_specification_unavailable.expected_data.data


# dataflow_action_request
# ---------------
def test_run_dataflow_request_disconnected(app_client, dataflow_run):
    response = emit_request(dataflow_run, app_client)
    assert (
        "External application is disconnected" == response["error"]["message"]
        and response["error"]["code"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


def test_validate_dataflow_request_disconnected(app_client, dataflow_validate):
    response = emit_request(dataflow_validate, app_client)
    assert (
        "External application is disconnected" == response["error"]["message"]
        and response["error"]["code"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


def test_export_dataflow_request_disconnected(app_client, dataflow_export):
    response = emit_request(dataflow_export, app_client)
    assert (
        "External application is disconnected" == response["error"]["message"]
        and response["error"]["code"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


# ---------------
