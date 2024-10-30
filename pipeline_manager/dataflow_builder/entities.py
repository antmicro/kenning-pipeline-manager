"""Module with definition of a dataflow graph's node."""

import json
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union, get_type_hints


@dataclass
class Vector2:
    """Class representation a two-dimensional (2D) mathematical vector."""

    x: float = 0.0
    y: float = 0.0
    _minimal_value: float = 0
    _maximal_value: float = 2**16

    def __add__(self, another: "Vector2") -> "Vector2":
        return Vector2(self.x + another.x, self.y + another.y)

    def to_json(self, as_str: bool = True) -> Union[str, Dict]:
        output = {
            "x": self.x,
            "y": self.y,
        }
        if as_str:
            return json.dumps(output)
        return output


class Direction(Enum):
    """Available directions of an interface."""

    INPUT = "input"
    OUTPUT = "output"
    INOUT = "inout"


class Side(Enum):
    """Sides, on which an interface may be located."""

    LEFT = "left"
    RIGHT = "right"


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


@dataclass
class Property(JsonConvertible):
    """A property of a node."""

    name: str
    value: Any
    id: str = str(uuid.uuid4())

    def to_json(self, as_str: bool = True) -> Union[Dict, str]:
        output = {
            "name": self.name,
            "value": self.value,
            "id": self.id,
        }
        if as_str:
            return json.dumps(output)
        return output


@dataclass
class Interface(JsonConvertible):
    """Representation of a node's interface."""

    name: str
    direction: Direction
    side: Optional[Side] = None
    side_position: Optional[int] = None
    external_name: Optional[str] = None
    id: str = str(uuid.uuid4())
    type: List[str] = field(default_factory=list)

    def __post_init__(self):
        if isinstance(self.direction, str):
            self.direction = Direction(self.direction)
        if isinstance(self.side, str):
            self.side = Side(self.side)

    def to_json(self, as_str: bool) -> Union[str, Dict]:
        if not self.side:
            if self.direction in (Direction.INOUT, Direction.INPUT):
                self.side = Side.LEFT
            else:
                self.side = Side.RIGHT

        output = {
            "name": self.name,
            "direction": self.direction.name.lower(),
            "side": self.side.name.lower(),
            "id": self.id,
            "sidePosition": self.side_position or 0,
        }

        # Notice conversion from snake_case to camelCase.
        # Optional fields.
        if self.external_name:
            output["externalName"] = self.external_name

        if self.type:
            output["type"] = self.type

        if as_str:
            return json.dumps(output)
        return output


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
    name: str
    position: Vector2
    properties: List[Property]
    interfaces: List[Interface]
    width: float
    two_column: bool
    instance_name: Optional[str] = None
    subgraph: Optional[str] = None
    enabled_interface_groups: List[Interface] = field(default_factory=List)

    # Attributes starting with a name starting with _ (underscore),

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

    def __init__(self, specification: Dict[str, Any], **kwargs: Dict):
        """
        Initialise a node based on the provided specification and
        `kwargs`.

        In `kwargs`, `name` key is required. Based on that key, attributes
        are filled with values from the provided specification. Default values
        from the specification may be overridden with parameters
        passed in `kwargs`.

        Parameters
        ----------
        specification : Dict[str, Any]
            Content of a specification file parsed to a Python dictionary.
        **kwargs : Dict
            Kwargs with parameter to override default values from the
            specification. Key `name` is required.

        Raises
        ------
        ValueError
            Raised if the specification does not define any nodes.
        ValueError
            Raised if illegal parameter was passed via `kwargs`.
            Allowed values include all attributes of `Node` class.
        """
        is_type_correct = False

        if "nodes" not in specification:
            raise ValueError(
                "The provided specification has no nodes defined. "
                "Missing `nodes` key. "
                f"Specification: {str(specification)}"
            )

        for node in specification["nodes"]:
            if "name" not in node:
                continue
            if node["name"] == kwargs["name"]:
                is_type_correct = True
                break

        if not is_type_correct:
            node_name = kwargs["name"]
            raise ValueError(
                f"Illegal name of the node `{node_name}`, "
                "which was not defined in the specification. "
            )

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

    def get(
        self, type: NodeAttributeType, **kwargs
    ) -> Union[List[Property], List[Interface]]:
        """
        Get either properties or interfaces matching criteria.

        Parameters
        ----------
        type : NodeAttributeType
            Type of an item to retrieve.
        **kwargs
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
            previous one True or not (False), by default False.
        """
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

    def to_json(self, as_str=True) -> Union[str, Dict]:
        output = {}
        for field_name, _ in get_type_hints(self).items():
            field_value = getattr(self, field_name)

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

        if as_str:
            return json.dumps(output)
        return output


@dataclass
class InterfaceConnection(JsonConvertible):
    """
    Representation of a connection between two interfaces in a dataflow graph.
    """

    # `from` is a reserved Python keyword.
    from_interface: Interface
    to_interface: Interface
    anchors: Optional[List[Vector2]] = None
    id: str = str(uuid.uuid4())

    def to_json(self, as_str: bool = True) -> Dict | str:
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
            json.dumps(output)
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
