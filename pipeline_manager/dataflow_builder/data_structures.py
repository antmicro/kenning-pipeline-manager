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


class DataflowBuilderError(Exception):
    """
    Top-level exception being a base class for all other exceptions
    from the dataflow builder module.
    """


# Interface exceptions


class InterfaceError(DataflowBuilderError):
    """General exception associated with an interface of a node."""


class InterfaceCountError(InterfaceError):
    """
    Raised if there is either too many or too few dynamic interfaces
    (than the specification requires).
    """


class MissingInterfaceAttributeError(InterfaceError):
    """Raised if an attribute was expected, but is missing."""


class MultipleInterfacesSelectedError(InterfaceError):
    """
    Raised if several interfaces were selected when only one was expected.
    """


class NotDynamicInterfaceError(InterfaceError):
    """
    Raised if a dynamic interface was expected
    but non-dynamic one was provided.
    """


class NoInterfaceMatchedError(InterfaceError):
    """
    Raised if no interface was matched
    but at least or more than one had to be matched.
    """


class InvalidInterfaceTypeError(InterfaceError):
    """
    Raised if an argument representing an interface has an unrecognized type
    (different than `Interface` and `dict`).
    """


class MissingInterfaceError(InterfaceError):
    """Raised if an interface is missing but should be present."""


class OutOfSpecificationInterfaceError(InterfaceError):
    """Raised if there is no such interface in a given node definition."""


# Property exceptions


class PropertyError(DataflowBuilderError):
    """General exception associated with an issue with a property of a node."""


class InvalidPropertyValueError(PropertyError):
    """Raised if the value of a property is invalid."""


class MissingPropertyError(PropertyError):
    """Raised if a property with a given names is missing."""


class InvalidPropertyTypeError(PropertyError):
    """
    Raised if an argument representing a property has an unrecognized type
    (different than `Property` and `dict`).
    """


# Node exceptions


class NodeError(DataflowBuilderError):
    """General exception associated with a problem with a node."""


class MissingNodeAttributeError(NodeError):
    """Raised if a given node lacks an expected attribute."""


class ExtraNodeAttributeError(NodeError):
    """
    Raised if an additional out-of-specification attribute
    was provided while creating a node.
    """


class OutOfSpecificationNodeError(NodeError):
    """Raised if a node is not present in the specification."""


class NodeLacksInterfacesError(NodeError):
    """Raised if the node lacks `interfaces` key."""


class MissingNodeError(NodeError):
    """
    Raised if a node is absent from the dataflow.
    """


# Graph exceptions


class GraphError(DataflowBuilderError):
    """
    General exception associated with a problem with a graph or its dataflow.
    """


class DuplicateExternalNamesError(GraphError):
    """Raised if interfaces share at least a single external name."""


class InvalidPanningError(GraphError):
    """
    Raised if a panning is either of invalid type
    or has invalid internal structure (missing attributes).

    Panning defines the position of the top-left corner
    in the rendered editor.
    """


class ScalingOutOfBoundsError(GraphError):
    """
    Raised if the value of scaling is outside the (0, max] range.

    The scaling defines the zoom level in the editor.
    """


class InvalidDataflowError(GraphError):
    """
    Raised if loading the dataflow generates an error.
    """


class NoGraphsError(GraphError):
    """Raised if no graph was found in the dataflow."""


class GraphRenamingError(GraphError):
    """Raised if there was an attempt to rename a graph."""


# Connection exceptions


class ConnectionError(DataflowBuilderError):
    """
    General exception associated with an issue with a connection
    between interfaces.
    """


class InvalidDirectionError(ConnectionError):
    """
    Raised if an interface receiving data has `output` direction
    or one sending data has input direction.
    """


class ConnectionExistsError(ConnectionError):
    """Raised if a connection two interfaces already exists."""


class MismatchingInterfaceTypesError(ConnectionError):
    """
    Raised if interfaces of mismatching types are connected.
    """


# Graph builder exceptions


class GraphBuilderError(DataflowBuilderError):
    """
    General exception associated with issues reported
    by the graph builder.
    """


class NotSpecificationError(GraphBuilderError):
    """
    Raised if a path does not lead to a file with the specification.
    """


class NoGraphSelectedError(GraphBuilderError):
    """
    Raised if no graph was selected but either one
    or more were expected to be selected.
    """


class ExternalValidatorError(GraphBuilderError):
    """Raised if an external JavaScript validator reports an error."""


class SpecificationWithoutNodesError(GraphBuilderError):
    """Raised if a specification does not define any nodes."""


class InvalidMethodUsedError(GraphBuilderError):
    """
    Raised if too general method was used when more specific one is available.
    """
