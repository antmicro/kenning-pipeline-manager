# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import threading
import multiprocessing
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
from pipeline_manager.backend.run_backend import create_backend, run_uvicorn


@pytest.fixture
def app_client():
    sio, app, _ = create_backend(
        ['', '--tcp-server-port', '12312',
         '--skip-frontend', '--skip-connecting']
    )
    server = multiprocessing.Process(
        target=run_uvicorn,
        args=(app, sio, "127.0.0.1", 32123),
    )
    server.start()
    time.sleep(1)
    yield
    server.terminate()
    server.join()


@pytest.fixture
def application_client(sample_specification, sample_dataflow):
    application_client = MockApplicationClient(
        "127.0.0.1", 32123, 12312, sample_specification, sample_dataflow
    )
    yield application_client
    application_client.disconnect()
    application_client.sio.disconnect()


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


_id = 0.5


def _curr_id():
    """
    Function returning sequence of numbers:
    1, 1, 2, 2, 3, 3, ...
    """
    global _id
    _id += 0.5
    return int(_id)


@pytest.fixture
def connect_success():
    return lambda: SingleRequest(
        "backend-api",
        JSONRPC20Response(_id=_curr_id(), result={}),
        JSONRPC20Request(_id=_curr_id(), method='external_app_connect')
    )


@pytest.fixture
def request_specification_success(sample_specification):
    return lambda: SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=_curr_id(), result={
                'type': MessageType.OK.value,
                'content': sample_specification,
            },
        ),
        JSONRPC20Request(_id=_curr_id(), method='request_specification')
    )


@pytest.fixture
def request_specification_unavailable():
    return lambda: SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=_curr_id(),
            error={
                'code': HTTPStatus.SERVICE_UNAVAILABLE.value,
                'message': 'External application is disconnected'
            }
        ),
        JSONRPC20Request(_id=_curr_id(), method='request_specification')
    )


@pytest.fixture
def dataflow_run(sample_dataflow):
    return lambda: SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=_curr_id(), result={'type': MessageType.OK.value},
        ),
        JSONRPC20Request(
            _id=_curr_id(),
            method='run_dataflow',
            params={'dataflow': sample_dataflow},
        )
    )


@pytest.fixture
def dataflow_validate(sample_dataflow):
    return lambda: SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=_curr_id(), result={'type': MessageType.OK.value},
        ),
        JSONRPC20Request(
            _id=_curr_id(),
            method='validate_dataflow',
            params={'dataflow': sample_dataflow},
        )
    )


@pytest.fixture
def dataflow_export(sample_dataflow):
    return lambda: SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=_curr_id(), result={'type': MessageType.OK.value},
        ),
        JSONRPC20Request(
            _id=_curr_id(),
            method='export_dataflow',
            params={'dataflow': sample_dataflow},
        )
    )


@pytest.fixture
def dataflow_import(sample_dataflow, sample_specification):
    return lambda: SingleRequest(
        "external-api",
        JSONRPC20Response(
            _id=_curr_id(), result={
                'type': MessageType.OK.value,
                'content': sample_specification,
            },
        ),
        JSONRPC20Request(
            _id=_curr_id(),
            method='import_dataflow',
            params={'external_application_dataflow': sample_dataflow},
        )
    )


@pytest.fixture
def get_status_connected():
    return lambda: SingleRequest(
        "backend-api",
        JSONRPC20Response(
            _id=_curr_id(), result={'status': {'connected': True}}
        ),
        JSONRPC20Request(_id=_curr_id(), method='get_status')
    )


@pytest.fixture
def get_status_disconnected():
    return lambda: SingleRequest(
        "backend-api",
        JSONRPC20Response(
            _id=_curr_id(), result={'status': {'connected': False}}
        ),
        JSONRPC20Request(_id=_curr_id(), method='get_status')
    )


def emit_request(request: SingleRequest, app: MockApplicationClient) -> Dict:
    return app.emit(request.name, request.arguments.data)


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
        connect_success(),
        get_status_disconnected(),
        request_specification_unavailable(),
        connect_success(),
        get_status_connected(),
        request_specification_success(),
    ]
    event_disconnected = threading.Event()
    event_spec_requested = threading.Event()

    def connect_and_request(app, responses):
        global_state_manager.reinitialize(
            application_client.external_port, application_client.host
        )

        for i, event in enumerate(events):
            if i == 2:
                event_disconnected.wait()
            responses.append(emit_request(event, app))

            if i == 2:
                event_spec_requested.set()

    responses = []
    process = threading.Thread(
        target=connect_and_request, args=(application_client, responses)
    )
    process.start()
    time.sleep(1)

    application_client.try_connecting()
    application_client.disconnect()
    event_disconnected.set()
    event_spec_requested.wait()
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
    events = [connect_success(), single_event()]

    def connect_and_request(app, responses):
        global_state_manager.reinitialize(
            application_client.external_port, application_client.host
        )

        for event in events:
            responses.append(emit_request(event, app))

    responses = []
    process = threading.Thread(
        target=connect_and_request, args=(application_client, responses)
    )
    process.start()
    time.sleep(1)

    application_client.try_connecting()
    application_client.answer_valid()

    process.join()

    data = responses[0]
    assert events[0].expected_data.data == data

    data = responses[1]
    assert events[1].expected_data.data == data


# ---------------


# get_status
# ---------------
def test_get_status_disconnected(
    app_client,
    application_client,
    get_status_disconnected,
):
    request = get_status_disconnected()
    response = emit_request(request, application_client)
    assert response == request.expected_data.data


# ---------------


# request_specification
# ---------------
def test_request_specification_disconnected(
    app_client,
    application_client,
    request_specification_unavailable,
):
    request = request_specification_unavailable()
    response = emit_request(request, application_client)
    assert response == request.expected_data.data


# dataflow_action_request
# ---------------
def test_run_dataflow_request_disconnected(
    app_client,
    application_client,
    dataflow_run,
):
    response = emit_request(dataflow_run(), application_client)
    assert (
        "External application is disconnected" == response["error"]["message"]
        and response["error"]["code"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


def test_validate_dataflow_request_disconnected(
    app_client,
    application_client,
    dataflow_validate,
):
    response = emit_request(dataflow_validate(), application_client)
    assert (
        "External application is disconnected" == response["error"]["message"]
        and response["error"]["code"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


def test_export_dataflow_request_disconnected(
    app_client,
    application_client,
    dataflow_export,
):
    response = emit_request(dataflow_export(), application_client)
    assert (
        "External application is disconnected" == response["error"]["message"]
        and response["error"]["code"] == HTTPStatus.SERVICE_UNAVAILABLE
    )


# ---------------
