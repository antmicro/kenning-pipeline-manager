# Copyright (c) 2024-2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with definition of a dataflow graph's node."""

import copy
import json
import re
import string
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union, get_type_hints

from typing_extensions import override

from pipeline_manager.dataflow_builder.data_structures import (
    Direction,
    DuplicateExternalNamesError,
    Infinity,
    InterfaceCountError,
    InvalidInterfaceTypeError,
    InvalidPropertyTypeError,
    InvalidPropertyValueError,
    MissingInterfaceAttributeError,
    MissingNodeAttributeError,
    MissingPropertyError,
    MultipleInterfacesSelectedError,
    NoInterfaceMatchedError,
    NotDynamicInterfaceError,
    OutOfSpecificationNodeError,
    Side,
    SpecificationWithoutNodesError,
)
from pipeline_manager.specification_builder import SpecificationBuilder


class JsonConvertible(ABC):
    """
    Abstract interface allowing object conversion to the JSON format.

    It ensure implementation of `to_json` method
    with a uniform signature.
    """

    @abstractmethod
    def to_json(self, as_str: bool = True) -> Union[Dict, str]:
        """
        Convert a dataflow graph to the JSON format.

        Parameters
        ----------
        as_str : bool, optional
            Determine return type. By default, True.

        Returns
        -------
        Union[Dict, str]
            Representation of the dataflow graph in JSON.
            If `as_str` is `True`, JSON in str is returned.
            Otherwise, a Python dictionary is returned.
        """
        pass


def get_uuid() -> str:
    """
    Generate universally unique identifier in version 4 as a string.

    Returns
    -------
    str
        Generated UUID.
    """
    return str(uuid.uuid4())


@dataclass
class Vector2(JsonConvertible):
    """Class representation of a two-dimensional (2D) mathematical vector."""

    x: float = 0.0
    y: float = 0.0
    _minimal_value: float = -(2**16)
    _maximal_value: float = 2**16

    def __add__(self, another: "Vector2") -> "Vector2":
        return Vector2(self.x + another.x, self.y + another.y)

    @override
    def to_json(self, as_str: bool = True) -> Union[str, Dict]:
        output = {
            "x": self.x,
            "y": self.y,
        }
        return convert_output(output, as_str)


@dataclass
class Property(JsonConvertible):
    """A property of a node."""

    name: str
    value: Any
    type: str
    id: str

    def __init__(
        self,
        name: str,
        type: Optional[str] = None,
        default: Optional[Any] = None,
        value: Optional[Any] = None,
        values: Optional[List[Any]] = None,
        min: Optional[str] = None,
        max: Optional[str] = None,
        dtype: Optional[str] = None,
        group: Optional[Dict[str, Any]] = None,
        id: str = get_uuid(),
    ):
        # In a specification, property has `default`,
        # but, in a dataflow, it has either `values` or `value`.
        if value is None and default is None and values is None:
            raise InvalidPropertyValueError(
                "Missing the value of a property. "
                "Provide either `value`, `values` or `default`."
            )
        self.value = Property.get_first_not_none([value, values, default])

        self.id = id
        self.name = name

        # Validate a type of `type` property.
        if type is not None:
            self.ensure_one_of(
                "type",
                type,
                (
                    "text",
                    "multiline",
                    "constant",
                    "number",
                    "integer",
                    "select",
                    "bool",
                    "slider",
                    "list",
                    "hex",
                ),
            )
            self.type = type

        if min:
            if isinstance(min, str):
                Property.ensure_hex(min)
            self.min = min

        if max:
            if isinstance(max, str):
                Property.ensure_hex(max)
            self.max = max

        if dtype:
            Property.ensure_one_of(
                "dtype", dtype, ["string", "number", "integer", "boolean"]
            )
            self.dtype = dtype

        if group:
            self.group = group

    @staticmethod
    def get_first_not_none(values: List[Optional[Any]]) -> Any:
        for value in values:
            return value

    @staticmethod
    def ensure_hex(value: str) -> None:
        if value.startswith("0x"):
            value = value[2:]
        for char in value:
            if char not in string.hexdigits:
                raise InvalidPropertyValueError(
                    "Minimum should be either a decimal or hexadecimal number."
                    f" Found an illegal character `{char}`."
                )

    @staticmethod
    def ensure_one_of(
        property_name: str, value: str, allowed: List[str]
    ) -> None:
        if value not in allowed:
            raise InvalidPropertyValueError(
                f"The {property_name} of property is `{value}`, "
                f"but should be one of: {', '.join(allowed)}."
            )

    @override
    def to_json(self, as_str: bool = True) -> Union[Dict, str]:
        output = {
            "name": self.name,
            "value": self.value,
            "id": self.id,
        }
        return convert_output(output, as_str)


@dataclass
class Interface(JsonConvertible):
    """Representation of a node's interface."""

    name: str
    direction: Direction
    side: Optional[Side] = None
    side_position: Optional[int] = None
    external_name: Optional[str] = None
    id: str = field(default_factory=get_uuid)
    type: List[str] = field(default_factory=list)

    def __post_init__(self):
        if isinstance(self.direction, str):
            self.direction = Direction(self.direction)
        if isinstance(self.side, str):
            self.side = Side(self.side)

    @override
    def to_json(self, as_str: bool = True) -> Union[str, Dict]:
        output = {
            "name": self.name,
            "direction": self.direction.name.lower(),
            "id": self.id,
        }

        # Notice conversion from snake_case to camelCase.
        # Optional fields.
        if self.side:
            output["side"] = self.side.name.lower()

        if self.side_position:
            output["sidePosition"] = self.side_position

        if self.external_name:
            output["externalName"] = self.external_name

        return convert_output(output, as_str)


class NodeAttributeType(Enum):
    """
    Available type of attributes that may be found with the `Node.get` method.
    """

    INTERFACE = "interfaces"
    PROPERTY = "properties"


@dataclass
class Node(JsonConvertible):
    """Representation of a node in a dataflow graph."""

    id: str
    _node_name: str
    _specification_builder: SpecificationBuilder
    width: float = 500
    properties: List[Property] = field(default_factory=list)
    interfaces: List[Interface] = field(default_factory=list)
    two_column: Optional[bool] = None
    position: Optional[Vector2] = None
    instance_name: Optional[str] = None
    color: Optional[str] = None
    subgraph: Optional[str] = None
    description: Optional[str] = None
    _subgraph: Any = None  # Optional[DataflowGraph]
    enabled_interface_groups: List[Interface] = field(default_factory=list)

    def set_property(self, property_name: str, property_value: Any) -> None:
        """
        Convenient setter to change value of a property of the node.

        Parameters
        ----------
        property_name : str
            Name of the property.
        property_value : Any
            New value of a property.

        Returns
        -------
        None

        Raises
        ------
        MissingPropertyError
            Raised if property with the supplied `property_named`
            was not found.
        """
        if not hasattr(self, "properties"):
            self.properties = []

        for property in self.properties:
            if property.name == property_name:
                property.value = property_value
                return
        raise MissingPropertyError(
            f"Property with name `{property_name}` was not found."
        )

    def get_property(self, property_name: str) -> Any:
        """
        Convenient getter to get value of a property of a node.

        Parameters
        ----------
        property_name : str
            Name of the property.

        Returns
        -------
        Any
            Value of the property.

        Raises
        ------
        MissingPropertyError
            Raised if the supplied name is not associated with any property.
        """
        for property in self.properties:
            if property.name == property_name:
                return property.value
        raise MissingPropertyError(
            f"Property with name `{property_name}` was not found."
        )

    def __init__(
        self,
        specification_builder: SpecificationBuilder,
        for_subgraph_node: bool = False,
        **kwargs,
    ):
        """
        Initialise a node based on the provided specification and
        `kwargs`.

        In `kwargs`, `name` key is required. Based on that key, attributes
        are filled with values from the provided specification. Default values
        from the specification may be overridden with parameters
        passed in `kwargs`.

        Parameters
        ----------
        specification_builder : SpecificationBuilder
            Instance of specification builder with a loaded specification.
        **kwargs
            Kwargs with parameter to override default values from the
            specification. Key `name` is required.

        Raises
        ------
        SpecificationWithoutNodesError
            Raised if the specification does not define any nodes.
        OutOfSpecificationNodeError
            Raised if a name of the node
            is absent from the specification.
        MissingNodeAttributeError
            Raised if an illegal parameter was passed via `kwargs`.
            Allowed values include all attributes of `Node` class.
        InvalidPropertyTypeError
            Raised if either the specification or kwargs contain
            an invalid type as a property definition. Allowed types:
            `Property`, `dict`.
        InvalidInterfaceTypeError
            Raised if either the specification or kwargs contain
            an invalid type as a interface definition. Allowed types:
            `Interface`, `dict`.
        """
        node_in_specification = False
        self._specification_builder = specification_builder
        nodes_in_specification = specification_builder._get_nodes(
            sort_spec=False
        )
        if not nodes_in_specification:
            raise SpecificationWithoutNodesError(
                "The provided specification has no nodes defined. "
                "Possibly the `nodes` key is missing. "
            )
        node_name = kwargs["name"]

        for node in nodes_in_specification:
            if "name" not in node:
                continue
            if node["name"] == node_name:
                node_in_specification = True
                break

        if not node_in_specification and not for_subgraph_node:
            node_name = kwargs["name"]
            raise OutOfSpecificationNodeError(
                f"Illegal name of the node `{node_name}`, "
                "which was not defined in the specification. "
            )

        if "name" in kwargs:
            setattr(self, "_node_name", node_name)
            del kwargs["name"]

        for key, value in kwargs.items():
            if key not in Node.__annotations__.keys():
                raise MissingNodeAttributeError(
                    f"There is no attribute `{key}` defined in Node."
                )

            # List of dictionary to list of Property objects conversion.
            if key == "properties" and len(value) > 0:
                properties = []
                for property_item in value:
                    if isinstance(property_item, Dict):
                        snake_cased_arguments = to_snake_case_keys(
                            property_item
                        )
                        properties.append(Property(**snake_cased_arguments))
                    elif isinstance(property_item, Property):
                        properties.append(property_item)
                    else:
                        raise InvalidPropertyTypeError(
                            (
                                "All properties must be either dicts or"
                                " Property instances. Received: "
                                f"{property_item} of type "
                                f"{type(property_item)}."
                            )
                        )
                value = properties

            # List of dictionary to list of Interface objects conversion.
            if key == "interfaces" and len(value) > 0:
                interfaces = []
                for interface in value:
                    if isinstance(interface, Dict):
                        interfaces.append(
                            Interface(
                                **{
                                    camel_case_to_snake_case(k): v
                                    for k, v in interface.items()
                                }
                            )
                        )
                    elif isinstance(interface, Interface):
                        interfaces.append(interface)
                    else:
                        raise InvalidInterfaceTypeError(
                            (
                                "All interfaces must be either dicts or"
                                " Interface instances. Received: "
                                f"{interface} of type {type(interface)}."
                            )
                        )
                value = interfaces

            setattr(self, key, value)

        # Ensure properties always exist.
        if not hasattr(self, "properties"):
            properties = []
            for node_specification in nodes_in_specification:
                for property_specification in node_specification.setdefault(
                    "properties", []
                ):
                    property = Property(**property_specification)
                    properties.append(property)

            if hasattr(self, "properties"):
                self.properties.extend(properties)
            else:
                self.properties = properties

    @staticmethod
    def init_subgraph_node(
        specification_builder: SpecificationBuilder,
        name: str,
        subgraph: Any,
        **kwargs,
    ) -> "Node":
        """
        An alternative constructor of Node object.

        Not for external use. Use `GraphBuilder.create_subgraph_node(...)`
        instead.

        Parameters
        ----------
        specification_builder : SpecificationBuilder
            Specification builder with loaded specification.
        name : str
            Name of the node.
        subgraph : DataflowGraph
            Dataflow graph that this node should contain.

        Returns
        -------
        Node
            Constructed Node object containing a subgraph.

        Raises
        ------
        RuntimeError
            Raised if `graph_id` of a non-existent graph is provided.
        """
        node = Node(
            for_subgraph_node=True,
            specification_builder=specification_builder,
            name=name,
        )
        node.id = get_uuid()
        node._node_name = name
        node._subgraph = subgraph
        node.subgraph = subgraph._id

        # Node interfaces are graph interfaces with `external_name`.
        node.interfaces = [
            interface
            for interface in copy.deepcopy(node._subgraph._get_interfaces())
            if interface.external_name is not None
        ]

        # `external_name` has to be unique among interfaces.
        external_names = [
            interface.external_name
            for interface in node.interfaces
            if interface.external_name is not None
        ]
        unique_external_names = set(external_names)
        if len(external_names) != len(unique_external_names):
            raise DuplicateExternalNamesError(
                "External names have to be unique, however, the following list"
                " of `external_name`s contain repetitions: "
                f"{', '.join(external_names)}."
            )

        return node

    @staticmethod
    def _get_dynamic_interface_property_name(
        name: str, direction: Direction
    ) -> str:
        return f"{name} {direction.value} count"

    def _create_dynamic_interfaces(self, name: str, **kwargs):
        """
        Create a minimal number of dynamic interfaces.

        Create a minimal number of dynamic interfaces, based on
        the specification of an interface and the provided attributes.

        Parameters
        ----------
        name : str
            Name of the dynamic interface.
        kwargs
            Attributes of a dynamic interface to be initialized.

        Raises
        ------
        MissingInterfaceAttributeError
            Raised if kwargs contain a definition of a non-dynamic
            interface (`dynamic` property is missing) or
            the direction of an interface cannot be found
            in its specification.
        """
        interface_definition = kwargs
        if not hasattr(self, "properties"):
            self.properties = []
        if not hasattr(self, "interfaces"):
            self.interfaces = []

        interface_name = name

        [interface_specification] = [
            interface_spec
            for interface_spec in self._specification_builder._nodes[
                self.name
            ]["interfaces"]
            if interface_spec["name"] == interface_name
        ]
        if "dynamic" not in interface_specification:
            raise MissingInterfaceAttributeError(
                "A missing property `dynamic` in an interface assumed to be "
                f"dynamic. Node name: `{interface_name}`."
            )
        dynamic = interface_specification["dynamic"]

        if "direction" not in interface_specification:
            raise MissingInterfaceAttributeError(
                "A dynamic interface has to have a direction."
            )
        direction = Direction(interface_specification["direction"])

        if isinstance(dynamic, bool):
            min_interfaces = 1
        else:
            dynamic = tuple(dynamic)
            min_interfaces, _ = dynamic

        # Create property controlling a number of interfaces.
        property = Property(
            name=Node._get_dynamic_interface_property_name(
                interface_name, direction
            ),
            value=min_interfaces,
        )
        self.properties.append(property)

        # Create actual interfaces.
        for i in range(min_interfaces):
            interface_definition["name"] = f"{interface_name}[{i}]"
            interface = Interface(**interface_definition)
            self.interfaces.append(interface)

    def set_number_of_dynamic_interfaces(
        self, interface_name: str, new_count: int
    ):
        """
        Set a number of dynamic interfaces to `new_count`.

        Parameters
        ----------
        interface_name : str
            Name of the dynamic interface.
        new_count : int
            Number of the dynamic interfaces that should exist in the end.

        Raises
        ------
        ValueError
            Raised if:
            - new interface count is equal to or lower than 0,
            - interface name is associated with none of the interfaces,

        MultipleInterfacesSelectedError
            Raised if the interface name is associated with
            more than one interface.
        MissingInterfaceAttributeError
            Raised if the interface is not dynamic
            due to missing `dynamic` attribute.
        NotDynamicInterfaceError
            Raised if the interface is not dynamic
            due to explicit definition in the specification.
        InterfaceCountError
            Raised if either maximum interface count from
            the specification was exceeded or it has gone below
            a minimum interface count from the specification.
        """
        if new_count <= 0:
            raise InterfaceCountError(
                "Number of interface has to be at least 1."
            )
        interfaces: List[Interface] = self.get(
            NodeAttributeType.INTERFACE,
            name=f"{interface_name}[0]",
        )
        interface_count = len(interfaces)
        if interface_count != 1:
            raise MultipleInterfacesSelectedError(
                "Provided name has to uniquely identify the dynamic interface."
                f"However, name = `{interface_name}` identifies "
                f"{interface_count} interfaces."
            )
        [interface] = interfaces

        node_specification = self._specification_builder._nodes[self.name]

        [interface_specification] = [
            interface_spec
            for interface_spec in node_specification["interfaces"]
            if interface_spec["name"] == interface_name
        ]
        if "dynamic" not in interface_specification:
            raise MissingInterfaceAttributeError(
                "A missing property `dynamic` in an interface assumed to be "
                f"dynamic. Node name: `{interface_name}`."
            )
        dynamic = interface_specification["dynamic"]
        if dynamic is None:
            raise NotDynamicInterfaceError(
                "Cannot set number of interface for a non-dynamic interface "
                f"with name = `{interface_name}`."
            )

        if isinstance(dynamic, bool):
            min_interfaces = 1
            max_interfaces = Infinity
        else:
            dynamic = tuple(dynamic)
            min_interfaces, max_interfaces = dynamic

        if max_interfaces is not Infinity and new_count > max_interfaces:
            raise InterfaceCountError(
                f"Cannot set the number of dynamic interfaces to "
                f"{new_count} as this value exceeds max = {max_interfaces}"
            )
        if new_count < min_interfaces:
            raise InterfaceCountError(
                f"Cannot set the number of dynamic interfaces to {new_count}"
                f"as this value is smaller than min = {min_interfaces}."
            )

        # Update the actual number of interfaces.
        property_name = Node._get_dynamic_interface_property_name(
            interface_name, interface.direction
        )
        old_count = int(self.get_property(property_name))
        repetitions = new_count - old_count
        if repetitions > 0:
            for _ in range(repetitions):
                self._increment_dynamic_interface_count(interface_name)
        else:
            for _ in range(-repetitions):
                self._decrement_dynamic_interface_count(interface_name)

    def get_interfaces_by_regex(self, pattern: str) -> List[Interface]:
        """
        Find interfaces with names matching `pattern`.

        Parameters
        ----------
        pattern : str
            Regular expression used to match the names of the interfaces.

        Returns
        -------
        List[Interface]
            List of interfaces matching `pattern` with their names.
        """
        pattern = re.compile(pattern)
        return [
            interface
            for interface in self.interfaces
            if re.search(pattern, interface.name)
        ]

    def _increment_dynamic_interface_count(self, interface_name: str):
        """
        Add a new dynamic interface.

        This method does not perform bounds checking.
        Use `set_number_of_dynamic_interfaces` instead.

        Parameters
        ----------
        interface_name : str
            Name of the dynamic interfaces.

        Raises
        ------
        InterfaceCountError
            Raised if value of dynamic interfaces is invalid (below 1).
        """
        max_index = self._find_highest_index_of_dynamic_interface(
            interface_name
        )
        if max_index == -1:
            raise InterfaceCountError(
                "Number of dynamic interface should never go below 1."
                f"However, currently for interface named `{interface_name}`, "
                "it is equal to 0."
            )

        # Create a new dynamic interface.
        [some_dynamic_interface] = self.get(
            NodeAttributeType.INTERFACE, name=f"{interface_name}[{max_index}]"
        )
        dynamic_interface: Interface = copy.deepcopy(some_dynamic_interface)
        dynamic_interface.id = get_uuid()
        dynamic_interface.name = f"{interface_name}[{max_index + 1}]"
        self.interfaces.append(dynamic_interface)

        # Update property counting that dynamic interfaces.
        property_name = self._get_dynamic_interface_property_name(
            interface_name, some_dynamic_interface.direction
        )
        self.set_property(property_name, max_index + 2)

    def _find_highest_index_of_dynamic_interface(
        self, interface_name: str
    ) -> int:
        dynamic_interfaces = self.get_interfaces_by_regex(
            rf"{interface_name}\[[0-9]+\]$"
        )
        max_index = -1
        index_pattern = re.compile(r"\[[0-9]+\]")
        for dynamic_interface in dynamic_interfaces:
            match = re.search(index_pattern, dynamic_interface.name).group(0)
            index = int(match[1:-1])
            if max_index < index:
                max_index = index

        return max_index

    def _decrement_dynamic_interface_count(self, interface_name: str):
        """
        Remove a single dynamic interface.

        Remove one dynamic interface associated with the provided
        `interface_name`. The interface with the highest index is
        always removed in the first place.

        Parameters
        ----------
        interface_name : str
            Name of the dynamic interface, from which an interface
            should be removed.

        Raises
        ------
        NoInterfaceMatchedError
            Raised if `interface_name` does not match any dynamic interface.
        """
        max_index = self._find_highest_index_of_dynamic_interface(
            interface_name
        )
        if max_index == -1:
            raise NoInterfaceMatchedError(
                f"Interface name `{interface_name}` does not match "
                "any dynamic interface."
            )

        [to_be_removed] = self.get(
            NodeAttributeType.INTERFACE, name=f"{interface_name}[{max_index}]"
        )
        self.interfaces = [
            interface
            for interface in self.interfaces
            if interface.id != to_be_removed.id
        ]

        property_name = self._get_dynamic_interface_property_name(
            interface_name, to_be_removed.direction
        )
        self.set_property(property_name, max_index)

    def get_number_of_dynamic_interfaces(self, interface_name: str) -> int:
        """
        Get a number of dynamic interfaces with a given name.

        Parameters
        ----------
        interface_name : str
            Name of the dynamic interface without any indices.

        Returns
        -------
        int
            Number of dynamic interfaces.

        Raises
        ------
        NoInterfaceMatchedError
            Raised if multiple properties representing the same number of
            dynamic interfaces exist.
        NotDynamicInterfaceError
            Raised if the provided interface is non-dynamic.
        """
        max_index = self._find_highest_index_of_dynamic_interface(
            interface_name
        )
        interfaces = [
            interface
            for interface in self._specification_builder._nodes[self.name][
                "interfaces"
            ]
            if interface["name"] == interface_name
        ]
        if len(interfaces) < 1:
            raise NoInterfaceMatchedError(
                f"No interface with name `{interface_name}` was found."
            )

        if "dynamic" not in interfaces[0]:
            raise NotDynamicInterfaceError(
                f"Interface with name `{interface_name} is not dynamic.`"
            )
        return max_index + 1

    def get(
        self, type: NodeAttributeType, **kwargs
    ) -> Union[List[Property], List[Interface]]:
        """
        Get either properties or interfaces matching criteria.

        Parameters
        ----------
        type : NodeAttributeType
            Type of an item to retrieve.
        kwargs : Any
            Criteria, which items have to satisfy.

        Returns
        -------
        Union[List[Property], List[Interface]]
            List of either Property or Interface instances.
        """
        items: List = getattr(self, type.value)
        return match_criteria(items=items, **kwargs)

    def move(self, new_position: Vector2, relative: bool = False):
        """
        Change a position of the node.

        Change a position of the node either in a relative manner or
        an absolute manner. Values are clamped to stay in the range
        of values.

        Parameters
        ----------
        new_position : Vector2
            If `relative` is False, then this a new position.
            Otherwise, it is a displacement (movement) vector.
        relative : bool, optional
            Whether position should be calculated based on the
            previous one (True) or not (False), by default False.
        """
        if self.position is None:
            self.position = Vector2()
        if relative:
            self.position += new_position
        else:
            self.position = new_position

        self.position.x = clamp(
            self.position.x,
            self.position._minimal_value,
            self.position._maximal_value,
        )
        self.position.y = clamp(
            self.position.y,
            self.position._minimal_value,
            self.position._maximal_value,
        )

    @override
    def to_json(self, as_str=True) -> Union[str, Dict]:
        output = {}
        for field_name, _ in get_type_hints(self).items():
            if not hasattr(self, field_name):
                continue

            field_value = getattr(self, field_name)

            if field_name == "_node_name":
                output["name"] = field_value

            # Attributes starting with a name starting with _ (underscore),
            # are not added to JSON file.
            if field_name.startswith("_"):
                continue

            if field_value is None:
                continue

            # Custom object
            if type(field_value) not in (
                bool,
                int,
                float,
                str,
            ) and not isinstance(field_value, List):
                field_value = field_value.to_json(as_str=False)

            # Iterables
            if isinstance(field_value, List):
                output_list = []
                for item in field_value:
                    output_list.append(item.to_json(as_str=False))

                field_value = output_list

            camel_cased_name = snake_case_to_camel_case(field_name)
            output[camel_cased_name] = field_value

        return convert_output(output, as_str)

    @property
    def name(self) -> str:
        """Getter to retrieve name of the node."""
        return self._node_name

    @name.setter
    def name(self, new_name: str):
        """
        Setter restricting setting a name of the node
        to those existing in specification.
        """
        updated = False
        nodes = self._specification_builder._get_nodes(sort_spec=False)
        for node in nodes:
            name_from_specification = node.get("name")
            if new_name == name_from_specification:
                self._node_name = new_name
                updated = True
                break

        if not updated:
            raise OutOfSpecificationNodeError(
                f"Cannot set a name of the node to `{new_name}` as that name "
                "does not appear in the specification."
            )


@dataclass
class InterfaceConnection(JsonConvertible):
    """
    Representation of a connection between two interfaces in a dataflow graph.
    """

    # `from` is a reserved Python keyword.
    from_interface: Interface
    to_interface: Interface
    anchors: Optional[List[Vector2]] = None
    id: str = field(default_factory=get_uuid)

    def to_json(self, as_str: bool = True) -> Union[str, Dict]:
        output = {
            # Renamed to the original names.
            "id": self.id,
            "from": self.from_interface.id,
            "to": self.to_interface.id,
        }
        if self.anchors:
            anchors = [anchor.to_json(as_str=False) for anchor in self.anchors]
            output["anchors"] = anchors

        if as_str:
            return json.dumps(
                output, ensure_ascii=False, indent=4, sort_keys=True
            )
        return output


# Defining this in utils causes circular dependency.
def snake_case_to_camel_case(name: str) -> str:
    """
    Convert an entity name from a snake case (snake_case) to
    a camel case (camelCase).

    Parameters
    ----------
    name : str
        Snake-cased name.

    Returns
    -------
    str
        Camel-cased name.
    """
    parts = name.split("_")
    title_cased_parts = [part.title() for part in parts]

    title_cased = "".join(title_cased_parts)
    first_character = title_cased[0]
    first_character = first_character.lower()

    return first_character + title_cased[1:]


def camel_case_to_snake_case(name: str) -> str:
    """
    Convert an entity name in a camel case (camelCase) to
    a snake case (snake_case).

    Parameters
    ----------
    name : str
        Camel-cased name.

    Returns
    -------
    str
        Snaked-cased name.
    """
    snake_cased = ""
    for letter in name:
        if letter.isupper():
            snake_cased += f"_{letter.lower()}"
        else:
            snake_cased += letter

    return snake_cased


def to_snake_case_keys(
    camel_cased_arguments: Dict[str, Any],
    allowed_keys: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Convert keys of a dictionary from camel case to snake case.

    Parameters
    ----------
    camel_cased_arguments : Dict[str, Any]
        Dictionary with keys (argument names) in camel case.
    allowed_keys : Optional[List[str]], optional
        Keys, in snake case, that are allowed.
        `None` means all keys are allowed, by default `None`.

    Returns
    -------
    Dict[str, Any]
        Dictionary with keys mapped to snake case.
        Only `allowed_keys` are included.
    """
    if allowed_keys:
        return {
            camel_case_to_snake_case(key): value
            for key, value in camel_cased_arguments.items()
            if camel_case_to_snake_case(key) in allowed_keys
        }

    return {
        camel_case_to_snake_case(key): value
        for key, value in camel_cased_arguments.items()
    }


def match_criteria(items: List, **kwargs) -> List[Any]:
    """
    Get a list of items matching criteria supplied in `kwargs`.

    Find items matching all the criteria (logical `AND` operator).
    Keys are names of attributes of an item.
    Values are values of attributes of an item.

    Parameters
    ----------
    items : List
        Items, against which the matching should be performed.
        Lack of criteria causes returning all items.
    **kwargs
        Attributes of items to match. Key match names of attributes,
        values - values of the attributes.


    Returns
    -------
    List[Any]
        Items matching the supplied criteria.
    """
    for search_key, desired_value in kwargs.items():
        items = [
            item
            for item in items
            if getattr(item, search_key) == desired_value
        ]
    return items


def clamp(value: float, minimum: float, maximum: float) -> float:
    """
    Clamp `value` are in the [minimum, maximum] range.

    Parameters
    ----------
    value : float
        Number to be clamped.
    minimum : float
        Lower bound of the range.
    maximum : float
        Upper bound of the range.

    Returns
    -------
    float
        Clamped number.
    """
    if value < minimum:
        return minimum
    elif value > maximum:
        return maximum
    return value


def convert_output(
    output: Dict[str, Any], as_str: bool
) -> Union[str, Dict[str, Any]]:
    """
    Convert a dictionary to either `str` or do not change,
    depending on the `as_str` parameter.

    Parameters
    ----------
    output : Dict[str, Any]
        Dictionary to be converted.
    as_str : bool
        Whether to convert.

    Returns
    -------
    Union[str, Dict[str, Any]]
        The converted output.
    """
    if as_str:
        return json.dumps(output, ensure_ascii=False, indent=4, sort_keys=True)
    return output
