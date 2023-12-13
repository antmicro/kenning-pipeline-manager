#!/usr/bin/env python3

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
A wrapper for server running.
"""

import sys

from pipeline_manager.backend.run_backend import main


def script_run(argv):  # noqa: D103
    return main(argv)


if __name__ == "__main__":
    ret = script_run(sys.argv)
    sys.exit(ret)
