# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import json
import tempfile
from importlib.resources import files
from pathlib import Path
from typing import Generator, List, Optional

import pytest

import examples
import examples.frontend_tests as frontend_tests
import pipeline_manager.frontend_tester as frontend_tester
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
    unresolved_specification_schema_path,
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


def example_pairs() -> Generator[List[List[Path]], None, None]:
    """
    Yields pairs of specification and dataflow paths.

    The pairs are taken from:
    * examples from `examples` directory
    * examples from `examples/frontend_tests` directory for frontend tester

    Yields
    ------
        List[List[Path] :
            Pair of specification and dataflow paths
    """
    specifications = [
        str(file)
        for file in Path(examples.__file__).parent.glob("*specification.json")
    ]
    dataflows = [
        str(file)
        for file in Path(examples.__file__).parent.glob("*dataflow.json")
    ]

    pairs: List[List[Path]] = []

    for spec in specifications:
        prefix = spec.rstrip("specification.json")
        corresponding_dataflow = prefix + "dataflow.json"

        if corresponding_dataflow in dataflows:
            pairs.append([Path(spec), Path(corresponding_dataflow)])

    frontend_tester_dataflows = [
        str(file)
        for file in Path(frontend_tests.__file__).parent.glob("*.json")
    ]

    # There is only one specification and dataflow in the module
    frontend_tester_specification = list(
        Path(frontend_tester.__file__).parent.glob("*specification.json")
    )[0]
    frontend_tester_dataflows += list(
        Path(frontend_tester.__file__).parent.glob("*dataflow.json")
    )

    for dataflow in frontend_tester_dataflows:
        pairs.append([Path(frontend_tester_specification), Path(dataflow)])

    yield from pairs


def check_validation(spec: str, dataflow: Optional[str] = None) -> int:
    """
    Validate specification and dataflow if provided.

    Parameters
    ----------
    spec : str
        Dataflow specification in JSON format to be validated.
    dataflow : Optional[str]
        Dataflow in JSON format to be validated.

    Returns
    -------
    int :
        Exit code of the validation process, 0 if successful.
    """
    dataflow_path = None
    with tempfile.TemporaryDirectory() as tmpdir:
        spec_path = Path(tmpdir) / "spec.json"
        dataflow_path = None
        with open(spec_path, "w") as specfile:
            json.dump(spec, specfile)
        if dataflow is not None:
            dataflow_path = Path(tmpdir) / "dataflow.json"
            with open(dataflow_path, "w") as dataflowfile:
                json.dump(dataflow, dataflowfile)
        dataflow_paths = [dataflow_path] if dataflow_path else []
        res = validate(
            specification_path=spec_path, dataflow_paths=dataflow_paths
        )
    return res
