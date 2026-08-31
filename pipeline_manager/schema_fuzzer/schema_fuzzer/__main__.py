# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Fuzz the specification schema and test it against the Kenning Pipeline Manager.
"""

from schema_fuzzer.cli import app

if __name__ == "__main__":
    app()
