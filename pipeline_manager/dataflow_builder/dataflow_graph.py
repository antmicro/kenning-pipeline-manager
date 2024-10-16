"""Module with DataflowGraph class for representing a dataflow graph."""

import json
from typing import Any, Dict, Union

from pipeline_manager.dataflow_builder.entities import (
    Interface,
    JsonConvertible,
    Node,
    NodeConnection,
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
        self._connections: Dict[str, NodeConnection] = {}
        self._specification: Dict[str, Any] = specification

    def create_node(self, **kwargs: Dict[str, Any]) -> Node:
        """
        Create the node initialized with the supplied arguments.
        `id` is already initialized.

        Default values are the following:

        type* -> default value
        ---
        `str` -> "INVALID_DEFAULT_NAME"
        `float` -> `0.0`
        `bool -> `False`
        `list` -> `[]` (empty list)
        `Vector2` -> `(0.0, 0.0)`

        *If `None` is possible, then value is `None`.

        Parameters
        ----------
        **kwargs : Dict[str, Any]
            Keyword arguments to initialise a newly created node.
            Check attributes of `Node` dataclass, to find all available keys.

        Returns
        -------
        Node
            The initialized node that belongs to the dataflow graph.

        """
        node_id = get_uuid()
        parameters = {
            "specification": self._specification,
            "id": node_id,
            "name": "INVALID_DEFAULT_NAME",
            "width": 0.0,
            "enabled_interface_groups": None,
            "instance_name": None,
            "interfaces": [],
            "position": Vector2(0, 0),
            "properties": [],
            "subgraph": None,
            "two_column": False,
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
    ) -> NodeConnection:
        from_interface = get_interface_if_present(from_interface, self._nodes)
        to_interface = get_interface_if_present(to_interface, self._nodes)

        connection_id = get_uuid()
        connection = NodeConnection(
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
            conn.to_json(as_str=False) for conn in self._connections.items()
        ]

        output = {"id": self._id, "nodes": nodes, "connections": connections}

        if as_str:
            return json.dumps(output)
        return output
