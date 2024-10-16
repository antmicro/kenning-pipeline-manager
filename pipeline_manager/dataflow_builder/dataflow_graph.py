"""Module with DataflowGraph class for representing a dataflow graph."""

import json
from typing import Any, Dict, Union

from pipeline_manager.dataflow_builder.entities import (
    Direction,
    Interface,
    InterfaceConnection,
    JsonConvertible,
    Node,
    Property,
    Vector2,
)
from pipeline_manager.dataflow_builder.utils import (
    ensure_connection_is_absent,
    get_interface_if_present,
    get_uuid,
)


class DataflowGraph(JsonConvertible):
    """Representation of a dataflow graph."""

    def __init__(self, specification: Dict[str, Any]):
        """Initialise a dataflow graph with default, mostly empty, values."""
        self._id = get_uuid()
        self._nodes: Dict[str, Node] = {}
        self._connections: Dict[str, InterfaceConnection] = {}
        self._specification: Dict[str, Any] = specification

    def create_node(self, **kwargs: Dict[str, Any]) -> Node:
        """
        Create the node initialized with the supplied arguments.
        `id` is already initialized.

        Default values are taken from the specification. They may
        be overridden by the values supplied in `kwargs`.

        Parameters
        ----------
        **kwargs : Dict[str, Any]
            Keyword arguments to initialise a newly created node.
            Check attributes of `Node` dataclass, to find all available keys.

        Returns
        -------
        Node
            The initialized node that belongs to the dataflow graph.

        Raises
        ------
        ValueError
            Raised if `name` key is missing in the `kwargs` directory
            or the provided name of the node does not exists in the
            specification.
        """
        if "name" not in kwargs:
            raise ValueError(
                "Missing parameter `name`, which is required "
                "to create new node."
            )

        base_node = None
        for _node in self._specification["nodes"]:
            # Not a node but a category.
            if "name" not in _node:
                continue
            if kwargs["name"] == _node["name"]:
                base_node = _node

        if not base_node:
            raise ValueError(
                f"Provided name of the node `{kwargs["name"]}` "
                "is missing in the specification."
            )

        node_id = get_uuid()

        # Take values for interface initialization from the specification.
        interfaces = []
        for interface in base_node["interfaces"]:
            _interface = Interface(
                name=interface["name"],
                direction=Direction(interface["direction"]),
            )
            interfaces.append(_interface)

        # Take values for properties initialization from the specification.
        properties = []
        if "properties" in base_node:
            for prop in base_node["properties"]:
                _property = Property(
                    name=prop["name"],
                    value=prop["default"],
                )
                properties.append(_property)

        DEFAULT_WIDTH = 200
        parameters = {
            "specification": self._specification,
            "id": node_id,
            "name": base_node["name"],
            "width": getattr(base_node, "width", DEFAULT_WIDTH),
            "enabled_interface_groups": [],
            "instance_name": None,
            "interfaces": interfaces,
            "position": Vector2(0, 0),
            "properties": properties,
            "subgraph": None,
            "two_column": self._specification["metadata"]["twoColumn"],
        }

        # Override default parameters
        for key, value in kwargs.items():
            parameters[key] = value

        self._nodes[node_id] = Node(**parameters)
        return self._nodes[node_id]

    def create_connection(
        self,
        from_interface: Union[Interface, str],
        to_interface: Union[Interface, str],
    ) -> InterfaceConnection:
        from_interface = get_interface_if_present(from_interface, self._nodes)
        to_interface = get_interface_if_present(to_interface, self._nodes)

        if from_interface is None:
            raise ValueError(
                "Source interface is "
                "not present in the dataflow graph."
                f"{from_interface}"
            )

        if to_interface is None:
            raise ValueError(
                "Destination (drain) interface is "
                "not present in the dataflow graph."
                f"{to_interface}"
            )

        connection_id = get_uuid()
        connection = InterfaceConnection(
            id=connection_id,
            from_interface=from_interface,
            to_interface=to_interface,
        )

        ensure_connection_is_absent(
            connection=connection,
            connections=self._connections,
        )

        # TODO: Implement the following checks:
        # interfaces exist
        # interfaces have the same data type

        self._connections[connection_id] = connection
        return self._connections[connection_id]

    def to_json(self, as_str: bool = True) -> Union[str, Dict]:
        nodes = [node.to_json(as_str=False) for _, node in self._nodes.items()]
        connections = [
            conn.to_json(as_str=False) for _, conn in self._connections.items()
        ]

        output = {"id": self._id, "nodes": nodes, "connections": connections}

        if as_str:
            return json.dumps(output)
        return output
