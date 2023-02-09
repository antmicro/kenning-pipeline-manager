from http import HTTPStatus

import pytest

from pipeline_manager.backend.app import app as flask_app


@pytest.fixture
def http_client():
    flask_app.testing = True
    return flask_app.test_client()


# /import_dataflow
# ---------------
def test_import_dataflow(http_client):
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
def test_request_specification(http_client):
    response = http_client.get('/request_specification')
    assert b'External application is disconnected' in response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
# ---------------


# /dataflow_action_request/<action>
# ---------------
def test_run_dataflow_request(http_client):
    response = http_client.post('/dataflow_action_request/run')
    assert b'External application is disconnected' in response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE


def test_validate_dataflow_request(http_client):
    response = http_client.post('/dataflow_action_request/validate')
    assert b'External application is disconnected' in response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE


def test_export_dataflow_request(http_client):
    response = http_client.post('/dataflow_action_request/export')
    assert b'External application is disconnected' in response.data and \
        response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
# ---------------
