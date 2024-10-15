"""Module with definition of a dataflow graph's node."""

import json
import uuid
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


@dataclass
class Property:
    """A property of a node."""

    name: str
    value: Any
    id: str = str(uuid.uuid4())


@dataclass
class Interface:
    """Representation of a node's interface."""

    name: str
    direction: Direction
    side_position: int
    external_name: Optional[str] = None
    id: str = str(uuid.uuid4())

    def to_json(self, as_str: bool) -> Union[str, Dict]:
        output = {
            "name": self.name,
            "direction": self.direction.name.lower(),
            "sidePosition": self.side_position,  # snake_case to camelCase
            "id": self.id,
        }

        if self.external_name:
            output["external_name"] = self.external_name

        if as_str:
            return json.dumps(output)
        return output


@dataclass
class Node:
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
                continue

            camel_cased_name = snake_case_to_camel_case(field_name)
            output[camel_cased_name] = field_value

        if as_str:
            return json.dumps(output)
        return output


@dataclass
class NodeConnection:
    """
    Representation of a connection between two nodes in a dataflow graph.
    """

    # `from` is a reserved Python keyword.
    from_node: Node
    to_node: Node
    anchors: List[Vector2]
    id: str = str(uuid.uuid4())


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
