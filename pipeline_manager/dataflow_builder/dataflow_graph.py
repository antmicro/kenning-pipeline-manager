"""Module with DataflowGraph class for representing a dataflow graph."""

import json
from typing import Dict, Union

from pipeline_manager.dataflow_builder.entities import (
    Node,
    NodeConnection,
    Vector2,
)
from pipeline_manager.dataflow_builder.utils import (
    ensure_connection_is_absent,
    get_node_if_present,
    get_uuid,
)


class DataflowGraph:
    """Representation of a dataflow graph."""

    def __init__(self):
        """Initialise a dataflow graph with default, mostly empty, values."""
        self._id = get_uuid()
        self._nodes: Dict[str, Node] = {}
        self._connections: Dict[str, NodeConnection] = {}

    def create_node(self) -> Node:
        """
        Create and return an node with initialized id and remaining parameters
        initialized with default values.

        Default values are the following:

        type* -> default value
        ---
        `str` -> ""
        `float` -> `0.0`
        `bool -> `False`
        `list` -> `[]` (empty list)
        `Vector2` -> `(0.0, 0.0)`

        *If `None` is possible, then value is `None`.

        """
        id = get_uuid()
        self._nodes[id] = Node(
            id=id,
            name="",
            width=0.0,
            enabled_interface_groups=None,
            instance_name=None,
            interfaces=[],
            position=Vector2(0, 0),
            properties=[],
            subgraph=None,
            two_column=False,
        )
        return self._nodes[id]

    def create_connection(
        self, source: Union[Node, str], target: Union[Node, str]
    ) -> NodeConnection:
        source = get_node_if_present(source, self._nodes)
        target = get_node_if_present(target, self._nodes)

        connection_id = get_uuid()
        connection = NodeConnection(
            id=connection_id,
            source_node=source,
            drain_node=target,
        )

        ensure_connection_is_absent(
            connection=connection,
            connections=self._connections,
        )

        # TODO: Implement the following checks:
        # interfaces exist
        # interfaces are not part of any connection (not connected yet)
        # interfaces have the same type of data flowing

        self._connections[connection_id] = connection
        return self._connections[connection_id]

    def to_json(self, as_str: bool = True) -> Union[str, Dict]:
        """
        Convert a dataflow graph to a JSON.

        Parameters
        ----------
        as_str : bool
            Determine return type. By default, True.

        Returns
        -------
        Union[str, Dict]
            Representation of the dataflow graph in JSON.
            If `as_str` is `True`, JSON in str is returned.
            Otherwise, a Python dictionary is returned.
        """
        nodes = [node.to_json(as_str=False) for _, node in self._nodes.items()]
        connections = [
            conn.to_json(as_str=False) for conn in self._connections.items()
        ]

        output = {"id": self._id, "nodes": nodes, "connections": connections}

        if as_str:
            return json.dumps(output)
        return output
