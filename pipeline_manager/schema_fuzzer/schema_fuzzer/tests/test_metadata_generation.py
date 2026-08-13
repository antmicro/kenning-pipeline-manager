"""
Module that implements simple schema generation test.
"""

import json
from pathlib import Path

import jsonschema

from schema_fuzzer.generator import Context
from schema_fuzzer.resolver import resolve_references

METADATA_SCHEMA_PATH = (
    Path(__file__).parent / "../../../resources/schemas/metadata_schema.json"
)
COMMON_TYPES_PATH = (
    Path(__file__).parent / "../resources/api_specification/common_types.json"
)

ITERATIONS = 100


def test_metadata_generation():
    """
    Generate random samples from the given schema and verify that all of them
    conform with the schema.

    """
    with open(METADATA_SCHEMA_PATH, "r") as f:
        schema = json.load(f)

    with open(COMMON_TYPES_PATH, "r") as f:
        common_types = json.load(f)

    # Resolve internal references inside the schema.
    resolve_references([schema, common_types])
    # Instantiate context object with default settings.
    context = Context({})
    # Obtain a generator for the given schema.
    generator = context.generator(schema)
    for _ in range(ITERATIONS):
        # Generate a random sample.
        sample = generator.generate()
        # Verify it does conform with the schema.
        jsonschema.validate(sample, schema)
