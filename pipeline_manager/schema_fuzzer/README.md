# Kenning Pipeline Manager Schema Fuzzer

## Introduction

This module implements a minimal JSON Schema fuzzer for the Kenning Pipeline Manager (KPM) specification and dataflow schema.
The goal of this module is to enable fuzzing based testing for the KPM.

## Example Usage

### Resolve references between schemas

```bash
python -m schema_fuzzer resolve FILES...
```

### Generate random sample from resolved schema

```bash
python -m schema_fuzzer generate FILE
```

### Get available configuration

```bash
python -m schema_fuzzer config-default
python -m schema_fuzzer config-schema
```

## Module Structure

- `generator` - Module responsible for generating random samples.
- `resolver.py` - Module responsible for resolving references between schemas.
- `joiner.py` - Module containing utility functions for recursively combining two schemas together.
- `tests` - Module containing tests.
- `cli.py` - Module containing command line interface.
