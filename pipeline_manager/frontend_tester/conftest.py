# Copyright (c) 2022-2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with `pytest` configuration."""

import pytest


def pytest_addoption(parser: pytest.Parser):
    """Adds `pytest` parser options."""
    parser.addoption(
        "--frontend-directory",
        help="Server app frontend directory. By default, "
        "temporary directory is created",
    )
    parser.addoption(
        "--playwright-trace",
        help="If provided, playwright trace will be saved in a "
        "'<NAME>-<TIMESTAMP>.zip'",
    )
