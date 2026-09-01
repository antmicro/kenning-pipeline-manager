#!/usr/bin/env python3

# Copyright (c) 2022-2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Main build script.
"""

import distutils.command.build
import os
import shutil
import sys
from pathlib import Path

from setuptools import setup

ROOT_DIR = Path(__file__).parent.absolute()
PREBUILT_FRONTEND_DIST_DIR = (
    ROOT_DIR / "pipeline_manager" / "prebuilt_frontend" / "dist"
)


class BuildCommand(distutils.command.build.build):
    """
    Overrides build command.
    """

    def initialize_options(self):
        distutils.command.build.build.initialize_options(self)
        self.build_base = "build-dir"

    def run(self):
        skip_frontend_build = os.environ.get(
            "PIPELINE_MANAGER_SKIP_FRONTEND_BUILD"
        )
        if not skip_frontend_build:
            if shutil.which("npm") is None:
                raise RuntimeError(
                    "Program 'npm' required for building the frontend is not available.\n"  # noqa: E501
                    "Install the program or run build with PIPELINE_MANAGER_SKIP_FRONTEND_BUILD=1"  # noqa: E501
                )
            # Allow importing project modules
            if str(ROOT_DIR) not in sys.path:
                sys.path.insert(0, str(ROOT_DIR))
            from pipeline_manager.frontend_builder import build_frontend

            exit_status = build_frontend(
                build_type="server-app",
                mode="production",
                output_directory=PREBUILT_FRONTEND_DIST_DIR,
                clean_build=True,
            )
            if exit_status != 0:
                raise RuntimeError(
                    "Failed to build the prebuilt (server-mode) frontend."
                )

        distutils.command.build.build.run(self)


setup(cmdclass={"build": BuildCommand})
