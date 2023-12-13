#!/usr/bin/env python3

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Main build script.
"""

import distutils.command.build

from setuptools import setup


class BuildCommand(distutils.command.build.build):
    """
    Overrides build command.
    """

    def initialize_options(self):
        distutils.command.build.build.initialize_options(self)
        self.build_base = "build-dir"


setup(cmdclass={"build": BuildCommand})
