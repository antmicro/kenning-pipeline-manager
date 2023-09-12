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
    path = files(examples).joinpath("sample-specification.json")  # noqa: E501
    return Path(path)


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
    with open(sample_specification_path, "r") as f:
        specification = json.load(f)
    return specification


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
    path = files(examples).joinpath("sample-dataflow.json")
    return Path(path)


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
    with open(sample_dataflow_path, "r") as f:
        dataflow = json.load(f)
    return dataflow


@pytest.fixture
def unresolved_specification_schema_path() -> Path:
    """
    Fixture that returns path to `unresolved_specification_schema.json`
    in `examples` directory.

    Returns
    -------
    Path :
        Path to the jsonschema
    """
    path = files(schemas).joinpath("unresolved_specification_schema.json")  # noqa: E501
    return Path(path)


@pytest.fixture
def unresolved_specification_schema(
        unresolved_specification_schema_path
        ) -> Path:
    """
    Fixture that returns path to `unresolved_specification_schema.json`
    in `examples` directory.

    Returns
    -------
    Path :
        Path to the jsonschema
    """
    with open(unresolved_specification_schema_path, "r") as f:
        schema = json.load(f)
    return schema


@pytest.fixture
def metadata_schema_path() -> Path:
    """
    Fixture that returns path to `metadata_schema.json`
    in `examples` directory.

    Returns
    -------
    Path :
        Path to the jsonschema
    """
    path = files(schemas).joinpath("metadata_schema.json")  # noqa: E501
    return Path(path)


@pytest.fixture
def metadata_schema(metadata_schema_path) -> Path:
    """
    Fixture that returns path to `metadata_schema.json`
    in `examples` directory.

    Returns
    -------
    Path :
        Path to the jsonschema
    """
    with open(metadata_schema_path, "r") as f:
        schema = json.load(f)
    return schema


@pytest.fixture
def specification_schema_path() -> Path:
    """
    Fixture that returns path to `specification_schema.json`
    in `examples` directory.

    Returns
    -------
    Path :
        Path to the jsonschema
    """
    path = files(schemas).joinpath("specification_schema.json")  # noqa: E501
    return Path(path)


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
