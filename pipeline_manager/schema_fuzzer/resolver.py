# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Resolve JSON Schema references.

This module provides support for resolving simple inter- and intra- schema
dependencies. It does support `$defs` and `$ref` keywords, it does not support
`$anchor` keyword for now.

As for `$ref` support, it will work for referencing other files and schemas
defined using the `$defs` keyword. For obvious reasons it does not support
recursion, i.e. `"$ref": "#"`, or cyclic dependencies. Attempting to resolve
any of the aforementioned will result in an exception.
"""

import copy
from typing import Any, TypeAlias

Position: TypeAlias = list[str | int]
"""
Representation of a position inside a schema.

Any instance of this type represents a position of a value inside the parsed
JSON Schema. It can be retrieved by repeatedly indexing the schema object by
the consecutive elements of this type.

Examples
--------
A barebones retrieval of a value pointed to by a position could be implemented
as such::
    value = schema
    for i in position:
        value = value[i]
Such approach however doesn't perform any type or error checking. It is
recommended to use `position_get` and `position_set` utility functions instead.

"""


def find_references(schema: Any, values: bool = False) -> list[Position]:
    """
    Find the positions all reference objects in the schema.

    Parameters
    ----------
    schema : Any
        Parsed JSON Schema
    values : bool
        Return positions of the reference values, not the reference objects

    Returns
    -------
    list[Position]
        A list of positions of all reference objects in the schema

    Note
    ----
    This function by default will return positions of the reference objects,
    and not the positions of `$ref` values. I.e. you will get the position of
    `{ "$ref": "XYZ" }`, and not the position of `"XYZ"`. This behaviour can by
    changed setting the `values` argument to `True`.
    """
    # This implementation of the `find_references` utilizes simple DFS with
    # backtracking to search the entire schema graph for references.

    # A list of found reference objects so far
    results = []
    # A position that is currently being explored
    position = []

    def traverse(current):
        match current:
            case list():
                for i, subschema in enumerate(current):
                    position.append(i)
                    traverse(subschema)
                    position.pop()
            case dict():
                if "$ref" in current:
                    if values:
                        results.append([*position, "$ref"])
                    else:
                        results.append(copy.deepcopy(position))
                else:
                    for key, subschema in current.items():
                        position.append(key)
                        traverse(subschema)
                        position.pop()
            case _:
                return

    traverse(schema)
    return results


def get_position(schema: Any, position: Position) -> Any:
    """
    Get the object from a schema under a given position.

    Parameters
    ----------
    schema : Any
        Parsed JSON Schema
    position : Position
        Position to get the value from

    Returns
    -------
    Any
        The object from the specified position.

    Raises
    ------
    TypeError
        If any of the position elements is of wrong type, e.g. attempting to
        index an array with a string.
    """
    # Base case
    if not position:
        return schema

    # Recursive case
    head, *tail = position
    match head:
        case int():
            if type(schema) is not list:
                raise TypeError(f"Invalid subschema type for: `{head}`")
            return get_position(schema[head], tail)
        case str():
            if type(schema) is not dict:
                raise TypeError(f"Invalid subschema type for: `{head}`")
            return get_position(schema[head], tail)
        case _:
            raise RuntimeError(f"Invalid position segment type: {type(head)}")


def set_position(schema: Any, position: Position, value: Any):
    """
    Set the object in the schema under the specified position.

    Parameters
    ----------
    schema : Any
        Parsed JSON Schema
    position : Position
        Position in the schema to write the value to
    value : Any
        Object to be written

    Raises
    ------
    TypeError
        If any of the position elements is of wrong type, e.g. attempting to
        index an array with a string
    ValueError
        If an empty position is provided
    """
    if not position:
        raise ValueError("The position cannot be empty")

    head, *tail = position
    match head:
        case int():
            if type(schema) is not list:
                raise TypeError(f"Invalid subschema type for: `{head}`")
            if not tail:
                # Base case
                schema[head] = value
            else:
                # Recursive case
                set_position(schema[head], tail, value)
        case str():
            if type(schema) is not dict:
                raise TypeError(f"Invalid subschema type for: `{head}`")
            if not tail:
                # Base case
                schema[head] = value
            else:
                # Recursive case
                set_position(schema[head], tail, value)
        case _:
            raise RuntimeError(f"Invalid position segment type: {type(head)}")


def resolve_relative_identifiers(schema: Any):
    """
    Resolved relative identifiers in the provided schema.

    Json schema allows for referring to the `$defs` schemas defined in the same
    toplevel schema without using the full URI. E.g. `#/$defs/Coordinate"
    instead of `Node.json#/$defs/Coordinate` inside the `Node.json` toplevel
    schema.

    The purpose of this function is to expand all those relative references
    using the toplevel schema identifier defined with the `$id` keyword.

    Note
    ----
    Only toplevel, i.e. those with the `$id` keyword, schemas should be passed
    to this function. If the toplevel schema contains `$defs` subschemas their
    own relative references will also be resolved.

    Parameters
    ----------
    schema : Any
        Parsed toplevel JSON Schema

    Raises
    ------
    ValueError
        If the provided schema does not contain the `$id` keyword
    """
    if type(schema) is not dict or "$id" not in schema:
        raise ValueError("Provided schema does not contain the `$id` keyword")
    identifier = schema["$id"]
    refs = find_references(schema, values=True)
    for ref in refs:
        value = get_position(schema, ref)
        if value.startswith("#"):
            set_position(schema, ref, identifier + value)


def get_schema_symbols(schema: Any, toplevel: bool = False) -> dict[str, Any]:
    """
    For a given schema returns a dictionary of all the symbols defined in it.

    That is for a given schema it will return a dictionary mapping identifiers
    to the toplevel schema and it's respective members of the `$defs` section.

    Note
    ----
    By a symbol we mean any structure that can be referenced using the `$ref`
    object. (Well almost, because `$anchor` is not supported).

    Parameters
    ----------
    schema : Any
        Parsed JSON Schema
    toplevel : bool
        Return only toplevel definitions, i.e. ignore `$defs`

    Returns
    -------
    dict[str, Any]
        A dictionary mapping absolute references to their respective schemas.

    Raises
    ------
    ValueError
        If the provided schema does not contain the `$id` keyword

    """
    symbols = {}
    if "$id" not in schema:
        raise ValueError("The toplevel schema must contain the `$id` keyword")
    identifier = schema["$id"]
    symbols[identifier] = schema
    if "$defs" not in schema or toplevel:
        return symbols
    for def_name, def_schema in schema["$defs"].items():
        def_identifier = identifier + "#/$defs/" + def_name
        symbols[def_identifier] = def_schema
    return symbols


def detect_reference_cycles(schemas: list[Any]) -> bool:
    """
    Detect circular references inside the provided list of schemas.

    Parameters
    ----------
    schemas : list[Any]
        A list of parsed JSON Schemas

    Returns
    -------
    bool
        True is the provided list contains a circular reference

    """
    # This function is implemented using a simple DFS with backtracking.

    # First we create a dictionary of all symbols inside the provided schemas.
    symbols = {}
    for schema in schemas:
        schema_symbols = get_schema_symbols(schema)
        symbols.update(schema_symbols)

    # Now we construct a list of directed edges that represents an dependency
    # graph between the symbols.
    graph = []
    for identifier, schema in symbols.items():
        refs = find_references(schema, values=True)
        for ref in refs:
            ref_identifier = get_position(schema, ref)
            graph.append((identifier, ref_identifier))

    # A recursion stack for the DFS
    recursion = list()
    # A set of all the visited nodes.
    visited = set()

    def recurse(current):
        if current in recursion:
            return True
        if current in visited:
            return False
        visited.add(current)
        recursion.append(current)
        neighbours = [b for (a, b) in graph if a == current]
        for neighbour in neighbours:
            if recurse(neighbour):
                return True
        recursion.pop()
        return False

    vertices = [a for (a, _) in graph]
    for vertex in vertices:
        if vertex not in visited and recurse(vertex):
            return True
    return False


def resolve_references(schemas: list[Any]):
    """
    Resolves references in the provided schemas.

    When invoked it will:
    * Expand all relative identifiers inside the schemas
    * Replace all references with their targets

    Parameters
    ----------
    schemas : list[Any]
        A list of parsed JSON Schemas

    Raises
    ------
    ValueError
        If a circular reference is detected

    Note
    ----
    This function calls `resolve_relative_identifiers` and
    `detect_reference_cycles` internally, it is not necessary to call them
    manually when invoking this function. Consult their documentation for
    additional info on the raised exceptions.

    """
    symbols = {}
    for schema in schemas:
        resolve_relative_identifiers(schema)
        schema_symbols = get_schema_symbols(schema)
        symbols.update(schema_symbols)
    if detect_reference_cycles(schemas):
        raise ValueError("Cannot resolve. Circular reference found.")

    for schema in symbols.values():
        refs = find_references(schema)
        for ref in refs:
            identifier = get_position(schema, [*ref, "$ref"])
            if identifier not in symbols:
                raise KeyError(f"No symbol found for: {identifier}")
            set_position(schema, ref, symbols[identifier])
