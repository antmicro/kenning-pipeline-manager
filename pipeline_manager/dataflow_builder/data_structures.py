# Copyright (c) 2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with data structure for entities of a DataflowGraph."""
from enum import Enum


class Direction(Enum):
    """Available directions of an interface."""

    INPUT = "input"
    OUTPUT = "output"
    INOUT = "inout"


class Side(Enum):
    """Sides, on which an interface may be located."""

    LEFT = "left"
    RIGHT = "right"


Infinity = None
