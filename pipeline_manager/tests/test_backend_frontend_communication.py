import multiprocessing
from http import HTTPStatus
from typing import Any, NamedTuple
import time

import pytest

from pipeline_manager.utils.mock_application import MockApplicationClient
from pipeline_manager.backend.app import app as flask_app


@pytest.fixture
def http_client():
    flask_app.testing = True
    return flask_app.test_client()


@pytest.fixture
def application_client(sample_specification, sample_dataflow):
    application_client = MockApplicationClient(
        '127.0.0.1',
        9000,
        sample_specification,
        sample_dataflow
    )
    yield application_client
    application_client.disconnect()


class SingularRequest(NamedTuple):
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
def request_specification():
    return SingularRequest(
        '/request_specification',
        'get',
        HTTPStatus.OK
    )


@pytest.fixture
def dataflow_run(sample_dataflow):
    return SingularRequest(
        '/dataflow_action_request/run',
        'post',
        HTTPStatus.OK,
        b'Run was successful',
        {'dataflow': sample_dataflow}
    )


@pytest.fixture
def dataflow_validate(sample_dataflow):
    return SingularRequest(
        '/dataflow_action_request/validate',
        'post',
        HTTPStatus.OK,
        b'Validation was successful',
        {'dataflow': sample_dataflow}
    )


@pytest.fixture
def dataflow_export(sample_dataflow):
    return SingularRequest(
        '/dataflow_action_request/export',
        'post',
        HTTPStatus.OK,
        b'Export was successful',
        {'dataflow': sample_dataflow}
    )


@pytest.fixture
def dataflow_import(sample_dataflow_path):
    with open(sample_dataflow_path, 'rb') as f:
        yield SingularRequest(
            '/import_dataflow',
            'post',
            HTTPStatus.OK,
            None,
            {'external_application_dataflow': f}
        )


@pytest.fixture
def get_status():
    return SingularRequest(
        '/get_status',
        'get',
        HTTPStatus.OK,
        b'Client connected'
    )


# Multi-request tests
# ---------------
def test_connecting_multiple_times(http_client, application_client):
    """
    Test a scenario where a client connects, disconnects
    and then connects once again.
    """
    def connect_and_request(http_client, responses):
        endpoints = [
            '/connect',
            '/request_specification',
            '/get_status',
            '/connect',
            '/get_status',
            '/request_specification'
        ]

        for endpoint in endpoints:
            response = http_client.get(endpoint)
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

    expected_messages = [
        b'External application connected',
        b'External application is disconnected',
        b'Client not connected',
        b'External application connected',
        b'Client connected'
    ]
    expected_codes = [
        HTTPStatus.OK,
        HTTPStatus.SERVICE_UNAVAILABLE,
        HTTPStatus.SERVICE_UNAVAILABLE,
        HTTPStatus.OK,
        HTTPStatus.OK,
    ]

    for message, code, response in zip(expected_messages, expected_codes, responses):  # noqa: E501
        status_code, data = response
        assert message == data and status_code == code


@pytest.mark.parametrize(
    'singular_request', [
        'request_specification',
        'dataflow_run',
        'dataflow_validate',
        'dataflow_export',
        'dataflow_import',
        'get_status'
    ]
)
def test_singular_request_connected_valid(
        http_client,
        application_client,
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
        response = http_client.get('/connect')
        responses.append((response.status_code, response.data))

        if singular_request.method == 'get':
            response = http_client.get(singular_request.endpoint)
        elif singular_request.method == 'post':
            response = http_client.post(
                singular_request.endpoint,
                data=singular_request.post_data
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
    assert b'External application connected' == data and \
        status_code == HTTPStatus.OK

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
