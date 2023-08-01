# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
import argparse
import sys
from pipeline_manager.scripts.build import script_build
from pipeline_manager.scripts.cleanup import script_cleanup
from pipeline_manager.scripts.run import script_run
from pipeline_manager.scripts.validate import script_validate


def script_handler(argv, command):
    ret = 0

    if command == 'build':
        ret = script_build()
    if command == 'run':
        ret = script_run(argv)
    if command == 'validate':
        ret = script_validate()
    if command == 'cleanup':
        ret = script_cleanup(argv)

    return ret


def main():
    parser = argparse.ArgumentParser(
        prog='pipeline_manager',
        description='Command-line interface for Pipeline Manager',
        add_help=False
    )

    parser.add_argument(
        'command',
        help='Script command to execute',
        choices=['build', 'run', 'validate', 'cleanup']
    )

    args = parser.parse_known_args()

    sys.argv.remove(args[0].command)

    return script_handler(sys.argv, args[0].command)


if __name__ == '__main__':
    result = main()
    sys.exit(result)
