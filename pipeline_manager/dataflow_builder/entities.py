"""Module with definition of a dataflow graph's node."""

import json
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Union, get_type_hints


@dataclass
class Vector2:
    """Class representation a two-dimensional (2D) mathematical vector."""

    x: float = 0.0
    y: float = 0.0

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

    INPUT = 0
    OUTPUT = 1
    INOUT = 2


class Side(Enum):
    """Sides, on which an interface may be located."""

    LEFT = 0
    RIGHT = 1


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
    side_position: Optional[int] = None
    external_name: Optional[str] = None
    id: str = str(uuid.uuid4())

    def to_json(self, as_str: bool) -> Union[str, Dict]:
        output = {
            "name": self.name,
            "direction": self.direction.name.lower(),
            "id": self.id,
        }

        # snake_case to camelCase
        if self.side_position:
            output["sidePosition"] = self.side_position

        if self.external_name:
            output["externalName"] = self.external_name

        if as_str:
            return json.dumps(output)
        return output


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
    instance_name: Optional[str]
    subgraph: Optional[str]
    enabled_interface_groups: Optional[List[Interface]]

    def __init__(self, specification: Dict[str, Any], **kwargs):
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
            raise ValueError(
                f"Illegal name of the node `{kwargs["name"]}`, "
                "which was not defined in the specification. "
            )

        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_json(self, as_str=True) -> Union[str, Dict]:
        output = {}
        for field_name, _ in get_type_hints(self).items():
            field_value = getattr(self, field_name)

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
class NodeConnection(JsonConvertible):
    """
    Representation of a connection between two nodes in a dataflow graph.
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
            "from": self.from_interface,
            "to": self.to_interface,
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
