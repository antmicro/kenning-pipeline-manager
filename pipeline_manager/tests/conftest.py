from importlib.resources import files
import json

import pytest

from pipeline_manager import examples
from pipeline_manager.resources import schemas


@pytest.fixture
def sample_specification():
    sample_specification = json.loads(files(examples) \
        .joinpath('sample_specification.json').read_text())
    return sample_specification


@pytest.fixture
def specification_schema():
    specification_schema = json.loads(files(schemas) \
        .joinpath('dataflow_spec_schema.json').read_text())
    return specification_schema
