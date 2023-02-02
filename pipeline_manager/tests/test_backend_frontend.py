from pipeline_manager.backend.app import app as flask_app
import pytest
from http import HTTPStatus


@pytest.fixture
def http_client():
    flask_app.testing = True
    return flask_app.test_client()


def test_import_dataflow(http_client):
    response = http_client.post('/import_dataflow')
    assert b'External application is disconnected' in response.data


def test_load_dataflow(http_client, sample_dataflow_path):
    response = http_client.post(
        '/load_dataflow',
        data={'dataflow': sample_dataflow_path.open('rb')}
    )
    assert response.status_code == HTTPStatus.OK


def test_load_dataflow_empty(http_client, empty_file_path):
    response = http_client.post(
        '/load_dataflow',
        data={'dataflow': empty_file_path.open('rb')}
    )
    assert response.status_code == HTTPStatus.BAD_REQUEST and \
        b'Dataflow is not a valid save' in response.data


def test_request_specification(http_client):
    response = http_client.get('/request_specification')
    assert b'External application is disconnected' in response.data


def test_run_dataflow_request(http_client):
    response = http_client.post('/dataflow_action_request/run')
    assert b'External application is disconnected' in response.data


def test_validate_dataflow_request(http_client):
    response = http_client.post('/dataflow_action_request/validate')
    assert b'External application is disconnected' in response.data


def test_export_dataflow_request(http_client):
    response = http_client.post('/dataflow_action_request/export')
    assert b'External application is disconnected' in response.data
