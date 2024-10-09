"""Module with definition of a dataflow graph's node."""

import uuid
from dataclasses import dataclass


@dataclass
class Node:
    """Representation of a node in a dataflow graph."""

    id: str


@dataclass
class NodeConnection:
    """
    Representation of a connection between two nodes in a dataflow graph.
    """

    id: str = str(uuid.uuid4())
    source_node: Node
    drain_node: Node
