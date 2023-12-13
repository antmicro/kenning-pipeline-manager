# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import json
import tempfile
from importlib.resources import files
from pathlib import Path

import pytest

import examples
from pipeline_manager.frontend_builder import build_prepare
from pipeline_manager.resources import schemas
from pipeline_manager.validator import validate


@pytest.fixture(scope="session", autouse=True)
def prepare_validation_environment():
    build_prepare()


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
    -------
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
    -------
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
    in `resources` directory.

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
    in `resources` directory.

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
    in `resources` directory.

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
    in `resources` directory.

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
    in `resources` directory.

    Returns
    -------
    Path :
        Path to the jsonschema
    """
    path = files(schemas).joinpath("specification_schema.json")  # noqa: E501
    return Path(path)


@pytest.fixture
def specification_schema(specification_schema_path) -> Path:
    """
    Fixture that returns path to `specification_schema.json`
    in `resources` directory.

    Returns
    -------
    Path :
        Path to the jsonschema
    """
    with open(specification_schema_path, "r") as f:
        schema = json.load(f)
    return schema


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


def example_pairs():
    specifications = [
        str(file)
        for file in Path(examples.__file__).parent.glob("*specification.json")
    ]
    dataflows = [
        str(file)
        for file in Path(examples.__file__).parent.glob("*dataflow.json")
    ]

    for spec in specifications:
        prefix = spec.rstrip("specification.json")
        corresponding_dataflow = prefix + "dataflow.json"

        if corresponding_dataflow in dataflows:
            yield (
                Path(spec),
                Path(corresponding_dataflow),
            )


def check_validation(spec):
    with tempfile.TemporaryDirectory() as tmpdir:
        specpath = Path(tmpdir) / "spec.json"
        with open(specpath, "w") as specfile:
            json.dump(spec, specfile)
        res = validate(specpath)
    return res
