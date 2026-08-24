# Nodes

## Introduction

This module constitiudes of a library of nodes each of them responsible for a given JSON Schema syntax.

## Typical Structure

A typical submodule in this module contains of a few classes, most of the follow the same pattern:
- `...Schema` a Pydantic model responsible for validating if the provided schema does't contain invalid syntax or contradictory constraints.
- `...Config` a Pydantic model responsible for validating of storing configuration values for a given node. It is recommended that it doesn't contain any required fields.
- `...Generator` a `BaseGenerator` subclass representing the given node itself.
  This is the only class that is required to be present.

The `BaseGenerator` subclass is the only thing actually required for a working node implementation, see the `NullGenerator` for a very minimal node, and the `IntegerGenerator` for a more complicated node.
