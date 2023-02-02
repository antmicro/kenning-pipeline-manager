import jsonschema
import pytest


def test_example_specification(sample_specification, specification_schema):
    jsonschema.validate(sample_specification, specification_schema)


def test_example_specification_without_metadata(sample_specification, specification_schema):  # noqa: E501
    del sample_specification['metadata']
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(sample_specification, specification_schema)
