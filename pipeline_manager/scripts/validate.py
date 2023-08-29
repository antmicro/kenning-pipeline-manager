#!/usr/bin/env python3

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
import sys
import argparse

from pipeline_manager.validator import validate
from pipeline_manager.frontend_builder import build_prepare


def script_validate():
    validator_parser = argparse.ArgumentParser(
        description="Tool for validating dataflow and specification files"
    )
    validator_parser.add_argument(
        "specification_path",
        help="Path to specification file",
        type=Path,
    )
    validator_parser.add_argument(
        "dataflow_path",
        help="Path to dataflow file",
        nargs="?",
        type=Path,
    )
    validator_parser.add_argument(
        '--workspace-directory',
        help='Directory where the frontend sources should be stored',
        type=Path
    )
    validator_parser.add_argument(
        '--skip-install-deps',
        help='Tells if the npm install should be skipped or not',
        action='store_true'
    )
    args = validator_parser.parse_args()

    build_prepare(
        args.workspace_directory if 'workspace_directory' in args else None,
        skip_install_deps=args.skip_install_deps
    )

    args = {k: v for k, v in vars(args).items() if v is not None and k != 'skip_install_deps'}  # noqa: E501

    return validate(**args)


if __name__ == '__main__':
    ret = script_validate()
    sys.exit(ret)
