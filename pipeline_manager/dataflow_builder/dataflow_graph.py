"""Module with DataflowGraph class for representing a dataflow graph."""

from typing import Dict, Union

from pipeline_manager.dataflow_builder.node import Node, NodeConnection
from pipeline_manager.dataflow_builder.utils import (
    ensure_connection_is_absent,
    get_node_if_present,
    get_uuid,
)


class DataflowGraph:
    """Representation of a dataflow graph."""

    def __init__(self):
        self._id = get_uuid()
        self._nodes: Dict[str, Node] = {}
        self._connections: Dict[str, NodeConnection] = {}

    def create_node(self) -> Node:
        id = get_uuid()
        self._nodes[id] = Node(id=id)
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

    def to_json() -> str:
        raise NotImplementedError()
