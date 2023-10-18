#!/usr/bin/env python3

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import sys
from pipeline_manager.backend.main import main


def script_run(argv):
    return main(argv)


if __name__ == '__main__':
    ret = script_run(sys.argv)
    sys.exit(ret)
