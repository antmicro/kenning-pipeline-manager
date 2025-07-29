# Copyright (c) 2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with data structure for entities of a DataflowGraph."""
from enum import Enum

Infinity = None


class Direction(Enum):
    """Available directions of an interface."""

    INPUT = "input"
    OUTPUT = "output"
    INOUT = "inout"


class Side(Enum):
    """Sides, on which an interface may be located."""

    LEFT = "left"
    RIGHT = "right"


class InterfaceCountError(Exception):
    """Raised if there is either too many or too few dynamic interfaces."""


class MissingInterfaceAttributeError(Exception):
    """Raised if an attribute was expected, but is missing."""


class MultipleInterfacesSelectedError(Exception):
    """
    Raised if several interfaces were selected when only one was expected.
    """


class InvalidPropertyValueError(Exception):
    """Raised if the value of a property is invalid."""


class MissingPropertyError(Exception):
    """Raised if a property with a given names is missing."""


class OutOfSpecificationNodeError(Exception):
    """Raised if a node is not present in the specification."""


class SpecificationWithoutNodesError(Exception):
    """Raised if a specification does not define any nodes."""


class MissingNodeAttributeError(Exception):
    """Raised if a given node lacks an expected attribute."""


class ExtraNodeAttributeError(Exception):
    """
    Raised if an additional out-of-specification attribute
    was provided while creating a node.
    """


class InvalidPropertyTypeError(Exception):
    """
    Raised if an argument representing a property has an unrecognized type
    (different than `Property` and `dict`).
    """


class InvalidInterfaceTypeError(Exception):
    """
    Raised if an argument representing an interface has an unrecognized type
    (different than `Interface` and `dict`).
    """


class DuplicateExternalNamesError(Exception):
    """Raised if interfaces share at least a single external name."""


class NotDynamicInterfaceError(Exception):
    """
    Raised if a dynamic interface was expected
    but non-dynamic one was provided.
    """


class NoInterfaceMatchedError(Exception):
    """
    Raised if no interface was matched
    but at least or more than one had to be matched.
    """


class InvalidPanningError(Exception):
    """
    Raised if a panning is either of invalid type
    or has invalid internal structure (missing attributes).
    """


class ScalingOutOfBoundsError(Exception):
    """Raised if the value of scaling is outside the (0, max] range."""


class GraphRenamingError(Exception):
    """Raised if there was an attempt to rename a graph."""


class MissingInterfaceError(Exception):
    """Raised if an interface is missing but should be present."""


class NodeLacksInterfacesError(Exception):
    """Raised if the node lacks `interfaces` key."""


class OutOfSpecificationInterfaceError(Exception):
    """Raised if there is no such interface in a given node definition."""


class InvalidMethodUsedError(Exception):
    """
    Raised if too general method was used when more specific one is available.
    """


class InvalidDirectionError(Exception):
    """
    Raised if an interface receiving data has `output` direction
    or one sending data has input direction.
    """


class MismatchingInterfaceTypesError(Exception):
    """
    Raised if interfaces of mismatching types are connected.
    """
