# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import json
import tempfile
from importlib.resources import files
from pathlib import Path

import pytest

import examples
from pipeline_manager.resources import schemas


@pytest.fixture
def sample_specification_path() -> Path:
    """
    Fixture that returns path to `sample_specification.json`
    in `examples` directory.

    Returns
    -------
    Path :
        Path to the specification
    """
    sample_specification_path = files(examples).joinpath('sample-specification.json')  # noqa: E501
    return Path(sample_specification_path)


@pytest.fixture
def sample_specification(sample_specification_path) -> dict:
    """
    Fixture that reads specification that is stored
    in `sample_specification_path`.

    Returns
    ------
    dict :
        Sample specification
    """
    with open(sample_specification_path, 'r') as f:
        sample_specification = json.load(f)
    return sample_specification


@pytest.fixture
def sample_dataflow_path() -> Path:
    """
    Fixture that returns path to `sample_dataflow.json`
    in `examples` directory.

    Returns
    -------
    Path :
        Path to the dataflow
    """
    sample_dataflow_path = files(examples).joinpath('sample-dataflow.json')
    return Path(sample_dataflow_path)


@pytest.fixture
def sample_dataflow(sample_dataflow_path: Path) -> dict:
    """
    Fixture that reads specification that is stored
    in `sample_dataflow_path`.

    Returns
    ------
    dict :
        Sample specification
    """
    with open(sample_dataflow_path, 'r') as f:
        sample_dataflow = json.load(f)
    return sample_dataflow


@pytest.fixture
def specification_schema_path() -> Path:
    """
    Fixture that returns path to `dataflow_spec_schema.json`
    in `examples` directory.

    Returns
    -------
    Path :
        Path to the jsonschema
    """
    specification_schema_path = files(schemas).joinpath('dataflow_spec_schema.json')  # noqa: E501
    return Path(specification_schema_path)


@pytest.fixture
def specification_schema(specification_schema_path) -> dict:
    """
    Fixture that reads specification jsonschema that is stored
    in `specification_schema_path`.

    Returns
    ------
    dict :
        Sample specification
    """
    with open(specification_schema_path, 'r') as f:
        specification_schema = json.load(f)
    return specification_schema


@pytest.fixture
def empty_file_path() -> Path:
    """
    Fixture that returns path to a new temporary file that is closed
    automatically after using the fixture.

    Returns
    -------
    Path :
        Path to the tempfile
    """
    with tempfile.NamedTemporaryFile() as tmp_file:
        yield Path(tmp_file.name)
