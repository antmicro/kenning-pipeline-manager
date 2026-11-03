# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Recursively join JSON Schemas.

This module provides functions for joining two schema functions together.
"""

import itertools
from typing import Any


def join_types(fst: Any, snd: Any) -> Any:
    """
    Safely join two type signatures.

    This functions joins two JSON Schema type signatures, by choosing the lest
    restrictive signature that still satisfies both constraints.

    Examples
    --------
    int + int -> int
    [int, null] + [int] -> int
    [str, null] + [int, null] -> null
    str + int -> Error
    [str, null] + [int, object] -> Error

    Parameters
    ----------
    fst : Any
        First type signature to join together
    snd : Any
        Second type signature to join together

    Returns
    -------
    Any
        Signature that satisfies both of the provided constraints

    Raises
    ------
    TypeError
        Raised if the signatures are contradictory.
    """
    match (fst, snd):
        case str(), str():
            if fst != snd:
                raise TypeError(
                    f"Cannot join two type signatures: {fst} + {snd}"
                )
            return fst
        case list(), list():
            new_type = []
            for el in fst:
                if el not in snd:
                    continue
                new_type.append(el)
            if len(new_type) == 0:
                raise TypeError(
                    "Cant joint two unions, no common members: {fst} + {snd}"
                )
            return new_type
        case (str(), list()) | (list(), str()):
            el = fst if type(fst) is str else snd
            lst = fst if type(fst) is list else snd
            if el in lst:
                return el
            raise TypeError(f"Cannot restrict type: {lst} to {el}")


def join_schemas(fst: Any, snd: Any, ignore: set[str] | None = None) -> Any:
    """
    Recursively join two schemas.

    Parameters
    ----------
    fst : Any
        First schema to join together.
    snd : Any
        Second schema to join together.
    ignore : set[str] | None
        An optional set of keys to ignore while joining, useful for avoiding
        conflicts in $id or version.

    Returns
    -------
    Any
        Schema incomporating both `fst` and `snd` values.
    """
    ignore = ignore or set()

    def recurse(fst, snd, prev):
        if fst == snd:
            return fst
        match fst, snd:
            case dict(), dict():
                schema = {}
                for key in itertools.chain(fst, snd):
                    if key in ignore:
                        continue
                    match fst.get(key), snd.get(key):
                        case (None, value):
                            schema[key] = value
                        case (value, None):
                            schema[key] = value
                        case (a, b):
                            if key == "type" and prev != "properties":
                                schema[key] = join_types(a, b)
                            else:
                                schema[key] = recurse(a, b, key)
                return schema
            case list(), list():
                if prev == "required":
                    return list(set(itertools.chain(fst, snd)))
                else:
                    return [*fst, *snd]
            case _:
                raise TypeError(
                    f"Cannot join {type(fst)} with {type(snd)}: {fst} + {snd}"
                )

    return recurse(fst, snd, None)
