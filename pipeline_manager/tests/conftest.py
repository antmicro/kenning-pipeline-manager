from importlib.resources import files
import json
from pathlib import Path
import tempfile

import pytest

from pipeline_manager import examples
from pipeline_manager.resources import schemas


@pytest.fixture
def sample_specification() -> dict:
    sample_specification = json.loads(
        files(examples)
        .joinpath('sample_specification.json').read_text()
    )
    return sample_specification


@pytest.fixture
def sample_dataflow_path() -> Path:
    sample_dataflow_path = files(examples).joinpath('sample_dataflow.json')
    return sample_dataflow_path


@pytest.fixture
def sample_dataflow(sample_dataflow_path: Path) -> dict:
    sample_dataflow = json.loads(sample_dataflow_path).read_text()
    return sample_dataflow


@pytest.fixture
def specification_schema() -> dict:
    specification_schema = json.loads(
        files(schemas)
        .joinpath('dataflow_spec_schema.json').read_text()
    )
    return specification_schema


@pytest.fixture
def empty_file_path() -> Path:
    with tempfile.NamedTemporaryFile() as tmp_file:
        yield Path(tmp_file.name)
