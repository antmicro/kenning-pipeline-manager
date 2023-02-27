import json
import tempfile
from importlib.resources import files
from pathlib import Path

import pytest

from pipeline_manager import examples
from pipeline_manager.backend.state_manager import global_state_manager
from pipeline_manager.resources import schemas


@pytest.fixture
def sample_specification_path() -> Path:
    sample_specification_path = files(examples).joinpath('sample_specification.json')  # noqa: E501
    return sample_specification_path


@pytest.fixture
def sample_specification(sample_specification_path) -> dict:
    with open(sample_specification_path, 'r') as f:
        sample_specification = json.load(f)
        yield sample_specification


@pytest.fixture
def sample_dataflow_path() -> Path:
    sample_dataflow_path = files(examples).joinpath('sample_dataflow.json')
    return sample_dataflow_path


@pytest.fixture
def sample_dataflow(sample_dataflow_path: Path) -> dict:
    with open(sample_dataflow_path, 'r') as f:
        sample_dataflow = json.load(f)
        yield sample_dataflow


@pytest.fixture
def specification_schema_path() -> Path:
    specification_schema_path = files(schemas).joinpath('dataflow_spec_schema.json')  # noqa: E501
    return specification_schema_path


@pytest.fixture
def specification_schema(specification_schema_path) -> dict:
    with open(specification_schema_path, 'r') as f:
        specification_schema = json.load(f)
        yield specification_schema


@pytest.fixture
def empty_file_path() -> Path:
    with tempfile.NamedTemporaryFile() as tmp_file:
        yield Path(tmp_file.name)


@pytest.fixture
def tcp_server():
    server = global_state_manager.get_tcp_server()
    yield server
    server.disconnect()
