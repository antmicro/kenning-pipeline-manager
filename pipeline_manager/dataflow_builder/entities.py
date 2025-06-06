# Copyright (c) 2024-2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with definition of a dataflow graph's node."""

import copy
import json
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union, get_type_hints

from typing_extensions import override

from pipeline_manager.dataflow_builder.data_structures import Direction, Side
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
    id: str = field(default_factory=get_uuid)

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

        if self.side:
            output["side"] = self.side.name.lower()

        # Notice conversion from snake_case to camelCase.
        # Optional fields.
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
    width: float
    _specification_builder: SpecificationBuilder
    properties: List[Property] = field(default_factory=list)
    interfaces: List[Interface] = field(default_factory=list)
    two_column: Optional[bool] = None
    position: Optional[Vector2] = None
    instance_name: Optional[str] = None
    color: Optional[str] = None
    subgraph: Optional[str] = None
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
        KeyError
            Raised if property with the supplied `property_named`
            was not found.
        """
        for property in self.properties:
            if property.name == property_name:
                property.value = property_value
                return
        raise KeyError(f"Property with name `{property_name}` was not found.")

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
        ValueError
            Raised if:
            - the specification does not define any nodes,
            - illegal parameter was passed via `kwargs`.
              Allowed values include all attributes of `Node` class.
        """
        is_type_correct = False
        self._specification_builder = specification_builder
        nodes_in_specification = specification_builder._get_nodes(
            sort_spec=False
        )
        if not nodes_in_specification:
            raise ValueError(
                "The provided specification has no nodes defined. "
                "Possibly the `nodes` key is missing. "
            )

        for node in nodes_in_specification:
            if "name" not in node:
                continue
            if node["name"] == kwargs["name"]:
                is_type_correct = True
                break

        if not is_type_correct and not for_subgraph_node:
            node_name = kwargs["name"]
            raise ValueError(
                f"Illegal name of the node `{node_name}`, "
                "which was not defined in the specification. "
            )

        if "name" in kwargs:
            setattr(self, "_node_name", kwargs["name"])
            del kwargs["name"]

        for key, value in kwargs.items():
            if key not in Node.__annotations__.keys():
                raise KeyError(
                    f"There is no attribute `{key}` defined in Node."
                )

            # List of dictionary to list of Property objects conversion.
            if key == "properties" and len(value) > 0:
                if isinstance(value[0], Dict):
                    properties = []
                    for property in value:
                        snake_cased_arguments = {
                            camel_case_to_snake_case(key): value
                            for key, value in property.items()
                        }
                        properties.append(Property(**snake_cased_arguments))
                    value = properties

            # List of dictionary to list of Interface objects conversion.
            if key == "interfaces" and len(value) > 0:
                if isinstance(value[0], Dict):
                    interfaces = []
                    for interface in value:
                        snake_cased_arguments = {
                            camel_case_to_snake_case(key): value
                            for key, value in interface.items()
                        }
                        interfaces.append(Interface(**snake_cased_arguments))
                    value = interfaces

            setattr(self, key, value)

    @staticmethod
    def init_subgraph_node(
        specification_builder: SpecificationBuilder,
        name: str,
        subgraph: Any,
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
            raise RuntimeError(
                "External names have to be unique, however, the following list"
                " of `external_name`s contain repetitions: "
                f"{', '.join(external_names)}."
            )

        return node

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
        items: Dict = getattr(self, type.value)
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
            raise ValueError(
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
