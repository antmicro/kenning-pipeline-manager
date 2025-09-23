#!/usr/bin/env python3

# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Wraps the build methods for the frontend.
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.absolute()))

from pipeline_manager.frontend_builder import build_frontend  # noqa: E402


def script_build():  # noqa: D103
    parser = argparse.ArgumentParser(
        description="Tool for building the frontend application"
    )
    base_parser = argparse.ArgumentParser()
    base_parser.add_argument(
        "--assets-directory", help="Path to directory with assets"
    )
    base_parser.add_argument(
        "--editor-title",
        help="Set the title for the constructed page and visual editor",
    )
    base_parser.add_argument(
        "--output-directory",
        help="Directory where the built frontend should be stored",
        type=Path,
    )
    base_parser.add_argument(
        "--workspace-directory",
        help="Directory where the frontend sources should be stored",
        type=Path,
    )
    base_parser.add_argument(
        "--clean-build",
        help="If --output-directory and/or --workspace-directory is defined, "
        "it is cleared before putting built frontend application or "
        "frontend sources",
        action="store_true",
    )
    base_parser.add_argument(
        "--json_url_specification",
        help="Path to url substitution specification file",
        type=Path,
    )
    base_parser.add_argument(
        "--single-html",
        help="Path where single, self-contained HTML should be built",
        type=Path,
    )
    base_parser.add_argument(
        "--skip-install-deps",
        help="Tells if the npm install should be skipped or not",
        action="store_true",
    )
    base_parser.add_argument(
        "--skip-frontend-copying",
        help="Skip comparing and copying of the frontend/ directory",
        action="store_true",
    )
    base_parser.add_argument(
        "--favicon-path",
        help="Path to the SVG file with favicon for the web page",
        type=Path,
    )
    base_parser.add_argument(
        "--welcome-message",
        help="Message to be displayed on top of welcome view.",
        type=str,
    )
    subparsers = parser.add_subparsers(
        title="build_type",
        help="Build type of the frontend application",
        dest="build_type",
        required=True,
    )
    static_app_args = subparsers.add_parser(
        "static-html",
        help="Builds a static HTML page",
        parents=[base_parser],
        add_help=False,
    )
    static_app_args.add_argument(
        "specification", help="Path to specification file", nargs="?"
    )
    static_app_args.add_argument(
        "dataflow", help="Path to dataflow file", nargs="?"
    )
    static_app_args.add_argument(
        "--mode",
        help="Decides whether the mode of the static build, "
        "it can be set either to development or production",
        choices=["development", "production"],
        default="production",
    )
    static_app_args.add_argument(
        "--minify-specification",
        help="Creates a minimal specification for a given dataflow"
        " (using only types used in the dataflow)",
        action="store_true",
    )
    static_app_args.add_argument(
        "--graph-development-mode",
        help="Allows errors in the graph to occur and tries to visualize"
        "as much of the graph as possible for development purposes."
        "It provides a list of found errors.",
        action="store_true",
    )
    static_app_args.add_argument(
        "--save-img-path",
        help="Allows to save the graph to PNG. Provide path to where the image"
        " is supposed to be saved",
        type=Path,
    )

    server_app_args = subparsers.add_parser(
        "server-app",
        help="Builds frontend for a server-based application",
        parents=[base_parser],
        add_help=False,
    )
    server_app_args.add_argument(
        "--communication-server-host",
        help="Host address of the communication server",
        type=str,
    )
    server_app_args.add_argument(
        "--communication-server-port",
        help="Port of the communication server",
        type=int,
    )

    args = parser.parse_args()

    if args.assets_directory:
        args.assets_directory = os.path.realpath(args.assets_directory)

    args = {k: v for k, v in vars(args).items() if v is not None}

    return build_frontend(**args)


if __name__ == "__main__":
    ret = script_build()
    sys.exit(ret)
