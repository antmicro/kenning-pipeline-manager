#!/usr/bin/env python3

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import sys
import errno
from pathlib import Path
import subprocess
from typing import Optional

import pipeline_manager


def validate(
        specification_path: Path,
        dataflow_path: Optional[Path] = None,
        workspace_directory: Optional[Path] = None) -> int:
    """
    Validates specification, and optionally a graph associated with it.

    Parameters
    ----------
    specification_path: Path
        Path to the specification file
    dataflow_path: Path
        Path to the dataflow file
    workspace_directory: Path
        Tells where the sources of the frontend (used during validation) are
        stored. Equals None when workspace directory is an actual repository.

    Returns
    -------
    int: Error code from the validator.js script, 0 if successful
    """
    project_path = Path(__file__).parent.parent.absolute()
    frontend_path = project_path / 'pipeline_manager/frontend'

    if not workspace_directory and not ((Path.cwd() / 'pipeline_manager/frontend').is_dir() \
            and Path(pipeline_manager.__file__).samefile(Path.cwd() / 'pipeline_manager/__init__.py')):  # noqa E501
        print(
            'The build script requires providing workspace path for storing '
            'frontend sources for building purposes',
            file=sys.stderr
        )
        print(
            'Please provide it --workspace-directory',
            file=sys.stderr
        )
        return errno.EINVAL

    if workspace_directory:
        frontend_path = workspace_directory / 'frontend'

    if dataflow_path:
        exit_status = subprocess.run(
            [
                "node",
                "--no-warnings",
                "--loader",
                "ts-node/esm",
                "validator.js",
                specification_path.absolute(),
                dataflow_path.absolute(),
            ],
            cwd=frontend_path,
        )
    else:
        exit_status = subprocess.run(
            [
                "node",
                "--no-warnings",
                "--loader",
                "ts-node/esm",
                "validator.js",
                specification_path.absolute()
            ],
            cwd=frontend_path,
        )
    return exit_status.returncode
