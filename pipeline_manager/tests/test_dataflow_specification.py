from importlib.resources import files
import json
import jsonschema
import pytest

from pipeline_manager import examples
from pipeline_manager.resources import schemas


def test_example_specification():
    sample_specification = json.loads(files(examples) \
        .joinpath('sample-specification.json').read_text())

    specification_schema = json.loads(files(schemas) \
        .joinpath('dataflow_spec_schema.json').read_text())

    jsonschema.validate(sample_specification, specification_schema)


def test_example_specification_without_metadata():
    sample_specification = json.loads(files(examples) \
        .joinpath('sample-specification.json').read_text())
    del sample_specification['metadata']

    specification_schema = json.loads(files(schemas) \
        .joinpath('dataflow_spec_schema.json').read_text())

    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(sample_specification, specification_schema)
