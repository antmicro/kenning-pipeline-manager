#!/usr/bin/env python3

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import os.path
import shutil
import subprocess
import sys
from pathlib import Path


def script_cleanup(argv):

    base_dir = Path(os.path.dirname(__file__)).parent

    frontend_dir = base_dir / 'frontend'

    subprocess.run('npm run clean', shell=True, cwd=frontend_dir)

    if os.path.isdir(frontend_dir / 'dist'):
        shutil.rmtree(frontend_dir / 'dist', ignore_errors=True)

    if os.path.exists(frontend_dir / '.env.static.local'):
        os.remove(frontend_dir / '.env.static.local')

    if os.path.exists(frontend_dir / '.env.local'):
        os.remove(frontend_dir / '.env.local')

    return 0


if __name__ == '__main__':
    ret = script_cleanup(sys.argv)
    sys.exit(ret)
