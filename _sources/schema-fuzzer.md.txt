# Schema Fuzzer

## Introduction

- The Pipeline Manager project includes a `schema_fuzzer` module that implements a minimal JSON Schema fuzzer.
- The goal of this module is to enable fuzzing based testing for the KPM as such it implements all JSON Schema features used by it.

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

## Generator Module

### Introduction

This module contains code responsible for generating random samples from a given JSON Schema.
It achieves that by recursively constructing a generation tree,
where each node is responsible for a given element of JSON Schema syntax.
E.g: `NumberGenerator` class is a leaf node responsible for generating randon number inside the schema.
Similarly `ArrayGenerator` is a node that will instantiate a child node for every acceptable element type, and use them random amount of times to construct an array.

### Example Generation Tree

Let's now see how an example generation tree will look like, consider the schema below:
```json
{
    "$id": "user.json",
    "type": "object",
    "properties": {
        "firstname": {
            "type": "string"
        },
        "lastname": {
            "type": "string"
        },
        "email": {
            "type": ["string", "null"]
        }
    }
}
```
Such schema would result in the following generation tree:

```{md-mermaid}
graph TD

    A[ObjectGenerator]
    A -->|firstname| B1[StringGenerator]
    A -->|lastname| B2[StringGenerator]
    A -->|email| B3[UnionGenerator]
    B3 --> C1[NullGenerator]
    B3 --> C2[StringGenerator]
```

### Context

The most important class inside this module is the `Context`, when we want to generate samples, we instantiate it with given settings, and invoke the `generator` method with the JSON Schema as an parameter.
The context object will then iterate all defined nodes looking for a match.
If a given node class declares compatibility with the schema context will instantiate it by passing itself alongside with the schema to its constructor.
The newly created node is then responsible for validating if the constraints defined in the schema are not contradictory, and if required extracting subschema and requesting a child node from the context object for it.

### Nodes

Each file in the `nodes` module implements a subclass of the `BaseGenerator` that implements one aspect of the JSON Schema, such as `AnyOf` keyword or an object of type integer.
It does **not** however implement references between schemas, any schema passed to the context object needs to have its references resolved by the resolver module.
Each module implementation needs to be listed inside the context in the `__init__.py` list.

A typical submodule in this module contains of a few classes, most of the follow the same pattern:
- `...Schema` a Pydantic model responsible for validating if the provided schema does't contain invalid syntax or contradictory constraints.
- `...Config` a Pydantic model responsible for validating of storing configuration values for a given node. It is recommended that it doesn't contain any required fields.
- `...Generator` a `BaseGenerator` subclass representing the given node itself.
  This is the only class that is required to be present.

The `BaseGenerator` subclass is the only thing actually required for a working node implementation, see the `NullGenerator` for a very minimal node, and the `IntegerGenerator` for a more complicated node.

### Example Usage

```python
schema = {"type": "number"}

# We instantiate context with default settings.
context = Context({})
# We construct a simple generator tree.
generator = context.generator(schema)
# We should see a random float value.
print(generator.generate())
```
