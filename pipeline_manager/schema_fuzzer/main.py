# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Fuzz the specification schema and test it against the Kenning Pipeline Manager.
"""
import warnings

try:
    from pipeline_manager.schema_fuzzer.cli import app

    if __name__ == "__main__":
        app()
except ImportError:
    warnings.warn(
        "Missing schema_fuzzer dependencies, is schema_fuzzer extra installed?"
    )
    raise
