from http import HTTPStatus
import multiprocessing
import time
import json
from typing import NamedTuple, Any

import pytest

from pipeline_manager_backend_communication.misc_structures import MessageType, Status  # noqa: E501
from pipeline_manager_backend_communication.communication_backend import CommunicationBackend  # noqa: E501
from pipeline_manager.backend.app import app as flask_app


class MockApplicationClient(object):
    def __init__(self, host, port, sample_specification, sample_dataflow):
        self.host = host
        self.port = port
        self.sample_specification = sample_specification
        self.sample_dataflow = sample_dataflow

        self.client = CommunicationBackend(host, port)

    def try_connecting(self):
        while True:
            try:
                out = self.client.initialize_client()
                if out.status == Status.CLIENT_CONNECTED:
                    return
            except ConnectionRefusedError:
                time.sleep(0.1)

    def answer_valid(self):
        status, message = self.client.wait_for_message()
        if status == Status.DATA_READY:
            message_type, data = message
            if message_type == MessageType.VALIDATE:
                self.client.send_message(
                    MessageType.OK,
                    'Validation was successful'.encode(encoding='UTF-8')
                )
            elif message_type == MessageType.SPECIFICATION:
                self.client.send_message(
                    MessageType.OK,
                    json.dumps(
                        self.sample_specification
                    ).encode(encoding='UTF-8')
                )
            elif message_type == MessageType.RUN:
                self.client.send_message(
                    MessageType.OK,
                    'Run was successful'.encode(encoding='UTF-8')
                )
            elif message_type == MessageType.IMPORT:
                self.client.send_message(
                    MessageType.OK,
                    json.dumps(
                        self.sample_dataflow
                    ).encode(encoding='UTF-8')
                )
            elif message_type == MessageType.EXPORT:
                self.client.send_message(
                    MessageType.OK,
                    'Export was successful'.encode(encoding='UTF-8')
                )

    def answer_empty(self):
        status, message = self.client.wait_for_message()
        if status == Status.DATA_READY:
            message_type, data = message
            self.client.send_message(
                MessageType.OK,
                bytes()
            )

    def disconnect(self):
        self.client.disconnect()


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
def dataflow_validation(sample_dataflow):
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


# Multi-request tests
# ---------------
@pytest.mark.parametrize('singular_request', [
    "request_specification",
    "dataflow_run",
    "dataflow_validation",
    "dataflow_export",
    "dataflow_import"
])
def test_singular_request_connected_valid(
        http_client,
        application_client,
        singular_request,
        request):
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
    assert b'External application connected' in data and \
        status_code == HTTPStatus.OK

    status_code, data = responses[1]
    assert status_code == singular_request.expected_code
    if singular_request.expected_data is not None:
        assert singular_request.expected_data in data
# ---------------


# /get_status
# ---------------
def test_get_status_disconnected(http_client):
    response = http_client.get('/get_status')
    assert b'Client not connected' in response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
# ---------------


# /import_dataflow
# ---------------
def test_import_dataflow_disconnected(http_client):
    response = http_client.post('/import_dataflow')
    assert b'External application is disconnected' in response.data and \
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
        b'Dataflow is not a valid save' in response.data
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
        b'Specification is not a valid JSON' in response.data


def test_load_invalid_specification(http_client, sample_dataflow_path):
    response = http_client.post(
        '/load_specification',
        data={'specfile': sample_dataflow_path.open('rb')}
    )
    assert response.status_code == HTTPStatus.BAD_REQUEST and \
        b'Specification is invalid' in response.data
# ---------------


# /request_specification
# ---------------
def test_request_specification_disconnected(http_client):
    response = http_client.get('/request_specification')
    assert b'External application is disconnected' in response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE


# /dataflow_action_request/<action>
# ---------------
def test_run_dataflow_request_disconnected(http_client):
    response = http_client.post('/dataflow_action_request/run')
    assert b'External application is disconnected' in response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE


def test_validate_dataflow_request_disconnected(http_client):
    response = http_client.post('/dataflow_action_request/validate')
    assert b'External application is disconnected' in response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE


def test_export_dataflow_request_disconnected(http_client):
    response = http_client.post('/dataflow_action_request/export')
    assert b'External application is disconnected' in response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
# ---------------
