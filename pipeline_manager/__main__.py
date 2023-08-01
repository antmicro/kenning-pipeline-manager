# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
import sys
from pipeline_manager.scripts.build import script_build
from pipeline_manager.scripts.cleanup import script_cleanup
from pipeline_manager.scripts.run import script_run
from pipeline_manager.scripts.validate import script_validate


def main(argv):
    ret = 0

    if argv[1] == 'build':
        ret = script_build()
    if argv[1] == 'run':
        ret = script_run(argv)
    if argv[1] == 'validate':
        ret = script_validate()
    if argv[1] == 'cleanup':
        ret = script_cleanup(argv)

    return ret


if __name__ == '__main__':
    result = main(sys.argv)
    sys.exit(result)
