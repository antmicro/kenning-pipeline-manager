# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
CLI frontend for the schema schema_fuzzer module.
"""

import json
from pathlib import Path

from cyclopts import App
from rich.console import Console

from schema_fuzzer.generator.context import Context
from schema_fuzzer.resolver import get_schema_symbols, resolve_references

app = App()
console = Console()
stderr_console = Console(stderr=True)


@app.command
def resolve(files: list[Path]):
    """
    Resolve reverences in the provided schemas.

    Outputs resolved schema to the stdout.

    Parameters
    ----------
    files : list[Path]
        Paths to schema files
    """
    schemas = []
    for file in files:
        with open(file, "r") as f:
            schema = json.load(f)
        schemas.append(schema)
    stderr_console.log(
        f"[blue bold] Successfully loaded {len(schemas)} schemas"
    )
    resolve_references(schemas)
    for schema in schemas:
        toplevel = get_schema_symbols(schema, toplevel=True)
        for identifier, schema in toplevel.items():
            stderr_console.log(f"[blue bold] Resolved {identifier}")
            serialized = json.dumps(schema)
            console.print_json(serialized)


@app.command
def generate(file: Path, config: Path | None = None, samples: int = 1):
    """
    Generate samples from given schema file.

    Outputs generated samples to the stdout.

    Parameters
    ----------
    file : Path
        Path to JSON Schema file
    config : Path | None
        Path to configuration file
    samples : int
        Number of samples to generate
    """
    with open(file, "r") as f:
        schema = json.load(f)
    if config is not None:
        with open(config, "r") as f:
            config_values = json.load(f)
    else:
        config_values = {}
    resolve_references([schema])
    stderr_console.log("[blue bold] Successfully loaded schema")
    context = Context(config_values)
    generator = context.generator(schema)
    for i in range(samples):
        if samples != 1:
            stderr_console.log(f"[blue bold] Generated {i + 1}/{samples}")
        sample = generator.generate()
        serialized = json.dumps(sample)
        console.print_json(serialized)


@app.command
def config_schema():
    """
    Generate configuration schema.

    Outputs configuration schema to the stdout.
    """
    schema = Context.get_settings_schema()
    schema_json = json.dumps(schema)
    console.print_json(schema_json)


@app.command
def config_default():
    """
    Generate default config.

    Outputs config propagated with default values.
    """
    config = Context.get_default_settings()
    config_json = json.dumps(config)
    console.print_json(config_json)
