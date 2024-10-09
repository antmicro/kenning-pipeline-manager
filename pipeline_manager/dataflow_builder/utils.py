"""Module with dataflow builder's specific utility functions."""

import logging
import os
import uuid
from pathlib import Path
from typing import Dict, Tuple, Union

from pipeline_manager.dataflow_builder.node import Node, NodeConnection


def is_proper_input_file(
    file_path: Union[str, Path], intended_use: str = "specification"
) -> Tuple[bool, str]:
    """
    Determine if an input exists, is a regular file and contains
    any content.

    Parameters
    ----------
    file_path : Union[str, Path]
        Path to a file.
    intended_use : str, optional
        Single-word intended use of a file, by default "configuration".

    Returns
    -------
    Tuple[bool, str]
        Tuple of two values: 1) boolean - whether a file satisfies conditions
        of existence, being regular file, and having content, and 2) str -
        communicating a specific reason for failure.
    """
    intended_use = intended_use.title()

    if isinstance(file_path, str):
        file_path = Path(file_path)

    file_path = file_path.absolute()
    if not file_path.exists():
        message = f"{intended_use} file not found under {str(file_path)}."
        logging.info(message)
        return (False, message)

    if not os.path.isfile(file_path):
        message = (
            f"{intended_use} path ({str(file_path)}) does not lead "
            "to a regular file."
        )
        logging.info(message)
        return (False, message)

    with open(file_path, mode="rt", encoding="utf-8") as fd:
        if not fd.read():
            message = f"{intended_use} file {str(file_path)} is empty."
            logging.info(message)
            return (False, message)

    return (True, "File is a proper input.")


def get_uuid() -> str:
    """
    Generate universally unique identifier in version 4 as a string.

    Returns
    -------
    str
        Generated UUID.
    """
    return str(uuid.uuid4())


def ensure_connection_is_absent(
    connection: Union[NodeConnection, str],
    connections: Dict[str, NodeConnection],
) -> None:
    """
    Check if a connection is absent. Otherwise, an exception is raised.

    Parameters
    ----------
    connection : Union[NodeConnection, str]
        Connection, which presence should be verified. If str is given,
            only part of check may be performed.
    connections : Dict[str, NodeConnection]
        A dictionary of ids and connections between nodes in a dataflow graph.

    Raises
    ------
    KeyError
        Raised if a connection between nodes exists. For `str`.
    KeyError
        Raised if a connection between nodes exists.
            For `Connection` instance.

    Returns
    -------
    None
        Returned to get out of the function.
    """
    if isinstance(connection, str):
        if connection in connections:
            raise KeyError(
                f"Connection with id={connection} is present in a dataflow "
                "graph. Connection with the identical id already exists."
            )
        # No more checks are possible solely on an id.
        return None

    if isinstance(connection, NodeConnection):
        if connection.id in connections:
            raise KeyError(
                f"Connection with id={connection.id} is present "
                "in a dataflow graph."
                "Connection with the identical id already exists."
            )

        # TODO: Check if a connection, based on the same source
        # and target exists, then raise error if it does.
        # source = connection.source_node
        # target = connection.drain_node


def get_node_if_present(
    node: Union[Node, str], nodes: Dict[str, Node], node_name: str
) -> Node:
    """
    Get a node if is present in dataflow graph. Otherwise, raise an error.

    Parameters
    ----------
    node : Union[Node, str]
        Node, which presence is verified.
    nodes : Dict[str, Node]
        Dictionary of all available ids and nodes.
    node_name : str
        Textual representation. For example, `source` or target

    Returns
    -------
    Node
        Handle to the node present in the graph.

    Raises
    ------
    KeyError
        Raised if the node is absent in the graph. For `str`.
    KeyError
        Raised if the node is absent in the graph. For `Node` instance.
    """
    if isinstance(node, str):
        if node not in nodes:
            raise KeyError(
                f"{node_name.title()} node with id={node} is "
                "absent in the dataflow graph."
            )
        node = nodes[node]

    if node.id not in nodes:
        raise KeyError(
            f"{node_name.title()} node with id={node} is absent "
            "in the dataflow graph."
        )

    return node
