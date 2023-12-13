#!/usr/bin/env python3

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Implements cleanup of the frontend building.
"""

import argparse
import os.path
import shutil
import subprocess
import sys
from pathlib import Path


def script_cleanup(argv):  # noqa: D103
    parser = argparse.ArgumentParser(argv[0])
    parser.add_argument(
        "--frontend-directory",
        help="Location of the built frontend. "
        "Used only when custom --output-directory was specified during "
        "building.",
        type=Path,
    )
    parser.add_argument(
        "--workspace-directory",
        help="Location of the frontend sources. "
        "Used only when custom --workspace-directory was specified "
        "during building.",
        type=Path,
    )

    args = parser.parse_args(argv[1:])

    base_dir = Path(os.path.dirname(__file__)).parent

    frontend_dir = base_dir / "frontend/dist"
    workspace_dir = base_dir / "frontend"

    if args.frontend_directory:
        frontend_dir = args.frontend_directory
    if args.workspace_directory:
        workspace_dir = args.workspace_directory

    subprocess.run("npm run clean", shell=True, cwd=workspace_dir)

    if os.path.isdir(frontend_dir):
        shutil.rmtree(frontend_dir, ignore_errors=True)

    if os.path.exists(workspace_dir / ".env.static.local"):
        os.remove(workspace_dir / ".env.static.local")

    if os.path.exists(workspace_dir / ".env.local"):
        os.remove(workspace_dir / ".env.local")

    return 0


if __name__ == "__main__":
    ret = script_cleanup(sys.argv)
    sys.exit(ret)
