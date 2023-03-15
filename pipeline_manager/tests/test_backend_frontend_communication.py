import multiprocessing
from http import HTTPStatus
import json
from typing import Any, NamedTuple
import time

import pytest

from pipeline_manager.utils.mock_application import MockApplicationClient
from pipeline_manager.backend.state_manager import global_state_manager
from pipeline_manager.backend.app import app as flask_app


@pytest.fixture
def http_client():
    flask_app.testing = True
    return flask_app.test_client()


@pytest.fixture
def application_client(sample_specification, sample_dataflow):
    application_client = MockApplicationClient(
        '127.0.0.1',
        56565,
        sample_specification,
        sample_dataflow
    )
    yield application_client
    application_client.disconnect()


# Requests Fixtures
# ---------------
class SingleRequest(NamedTuple):
    """
    NamedTuple used to create fixtures that represent singular requests.

    Parameters
    ----------
    endpoint : str
        Endpoint of the backend that is being tested.
    method : str
        HTTP request method that should be used in lowercase. Currently
        only `post` and `get` are used.
    expected_code : HTTPStatus
        Expected HTTP code of the response.
    expected_data : Any
        Expected data of the response. If None then it is not checked.
    post_data : Any
        Data that should be embedded with a POST request.
    """
    endpoint: str
    method: str
    expected_code: HTTPStatus
    expected_data: Any = None
    post_data: Any = None


@pytest.fixture
def connect_success():
    return SingleRequest(
        '/connect',
        'get',
        HTTPStatus.OK,
        b'External application connected'
    )


@pytest.fixture
def request_specification_success():
    return SingleRequest(
        '/request_specification',
        'get',
        HTTPStatus.OK
    )


@pytest.fixture
def request_specification_unavailable():
    return SingleRequest(
        '/request_specification',
        'get',
        HTTPStatus.SERVICE_UNAVAILABLE,
        b'External application is disconnected'
    )


@pytest.fixture
def dataflow_run(sample_dataflow):
    return SingleRequest(
        '/dataflow_action_request/run',
        'post',
        HTTPStatus.OK,
        b'Run was successful',
        {'dataflow': sample_dataflow}
    )


@pytest.fixture
def dataflow_validate(sample_dataflow):
    return SingleRequest(
        '/dataflow_action_request/validate',
        'post',
        HTTPStatus.OK,
        b'Validation was successful',
        {'dataflow': sample_dataflow}
    )


@pytest.fixture
def dataflow_export(sample_dataflow):
    return SingleRequest(
        '/dataflow_action_request/export',
        'post',
        HTTPStatus.OK,
        b'Export was successful',
        {'dataflow': sample_dataflow}
    )


@pytest.fixture
def dataflow_import(sample_dataflow_path):
    with open(sample_dataflow_path, 'rb') as f:
        yield SingleRequest(
            '/import_dataflow',
            'post',
            HTTPStatus.OK,
            None,
            {'external_application_dataflow': f}
        )


@pytest.fixture
def get_status_connected():
    return SingleRequest(
        '/get_status',
        'get',
        HTTPStatus.OK,
        b'Client connected'
    )


@pytest.fixture
def get_status_disconnected():
    return SingleRequest(
        '/get_status',
        'get',
        HTTPStatus.SERVICE_UNAVAILABLE,
        b'Client not connected'
    )
# ---------------


# Multi-request tests
# ---------------
def test_connecting_multiple_times(
        http_client,
        application_client,
        sample_specification,
        connect_success,
        request_specification_success,
        request_specification_unavailable,
        get_status_connected,
        get_status_disconnected):
    """
    Test a scenario where a client connects, disconnects
    and then connects once again.
    """
    requests = [
        connect_success,
        get_status_disconnected,
        request_specification_unavailable,
        connect_success,
        get_status_connected,
        request_specification_success
    ]

    def connect_and_request(http_client, responses):
        global_state_manager.reinitialize(
            application_client.port,
            application_client.host
        )

        for req in requests:
            response = http_client.get(req.endpoint)
            responses.append((response.status_code, response.data))

    responses = (multiprocessing.Manager()).list()
    process = multiprocessing.Process(
        target=connect_and_request,
        args=(http_client, responses)
    )
    process.start()

    application_client.try_connecting()
    application_client.disconnect()
    time.sleep(1)
    application_client.try_connecting()
    application_client.answer_valid()

    process.join()

    for req, response in zip(requests, responses):
        status_code, data = response

        assert status_code == req.expected_code
        if req.expected_data is not None:
            assert req.expected_data == data

    status_code, data = responses[-1]
    assert (json.loads(data) == sample_specification and
            HTTPStatus.OK == status_code)


@pytest.mark.parametrize(
    'singular_request', [
        'request_specification_success',
        'dataflow_run',
        'dataflow_validate',
        'dataflow_export',
        'dataflow_import',
        'get_status_connected'
    ]
)
def test_singular_request_connected_valid(
        http_client,
        application_client,
        connect_success,
        singular_request,
        request):
    """
    Tests a scenario with a single request to an endpoint after connecting
    with the external application.

    It creates two asynchronous processes, one for the backend and one for the
    external application.

    The expected behaviour is described by `singular_request` fixture.
    """
    singular_request = request.getfixturevalue(singular_request)

    def connect_and_request(http_client, responses):
        global_state_manager.reinitialize(
            application_client.port,
            application_client.host
        )

        for req in [connect_success, singular_request]:
            if req.method == 'get':
                response = http_client.get(req.endpoint)
            elif req.method == 'post':
                response = http_client.post(
                    req.endpoint,
                    data=req.post_data
                )
            responses.append((response.status_code, response.data))

    responses = (multiprocessing.Manager()).list()
    process = multiprocessing.Process(
        target=connect_and_request,
        args=(http_client, responses)
    )
    process.start()

    application_client.try_connecting()
    application_client.answer_valid()

    process.join()

    status_code, data = responses[0]
    assert (connect_success.expected_data == data and
            connect_success.expected_code == status_code)

    status_code, data = responses[1]
    assert status_code == singular_request.expected_code
    if singular_request.expected_data is not None:
        assert singular_request.expected_data == data
# ---------------


# /get_status
# ---------------
def test_get_status_disconnected(http_client):
    response = http_client.get('/get_status')
    assert b'Client not connected' == response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
# ---------------


# /import_dataflow
# ---------------
def test_import_dataflow_disconnected(http_client):
    response = http_client.post('/import_dataflow')
    assert b'External application is disconnected' == response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
# ---------------


# /load_dataflow
# ---------------
def test_load_dataflow(http_client, sample_dataflow_path):
    response = http_client.post(
        '/load_dataflow',
        data={'dataflow': sample_dataflow_path.open('rb')}
    )
    assert response.status_code == HTTPStatus.OK


def test_load_empty_dataflow(http_client, empty_file_path):
    response = http_client.post(
        '/load_dataflow',
        data={'dataflow': empty_file_path.open('rb')}
    )
    assert response.status_code == HTTPStatus.BAD_REQUEST and \
        b'Dataflow is not a valid save' == response.data
# ---------------


# /load_specification
# ---------------
def test_load_specification(http_client, sample_specification_path):
    response = http_client.post(
        '/load_specification',
        data={'specfile': sample_specification_path.open('rb')}
    )
    assert response.status_code == HTTPStatus.OK


def test_load_empty_specification(http_client, empty_file_path):
    response = http_client.post(
        '/load_specification',
        data={'specfile': empty_file_path.open('rb')}
    )
    assert response.status_code == HTTPStatus.BAD_REQUEST and \
        b'Specification is not a valid JSON' == response.data


def test_load_invalid_specification(http_client, sample_dataflow_path):
    response = http_client.post(
        '/load_specification',
        data={'specfile': sample_dataflow_path.open('rb')}
    )
    assert response.status_code == HTTPStatus.BAD_REQUEST and \
        b'Specification is invalid' == response.data
# ---------------


# /request_specification
# ---------------
def test_request_specification_disconnected(http_client):
    response = http_client.get('/request_specification')
    assert b'External application is disconnected' == response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE


# /dataflow_action_request/<action>
# ---------------
def test_run_dataflow_request_disconnected(http_client):
    response = http_client.post('/dataflow_action_request/run')
    assert b'External application is disconnected' == response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE


def test_validate_dataflow_request_disconnected(http_client):
    response = http_client.post('/dataflow_action_request/validate')
    assert b'External application is disconnected' == response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE


def test_export_dataflow_request_disconnected(http_client):
    response = http_client.post('/dataflow_action_request/export')
    assert b'External application is disconnected' == response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
# ---------------
