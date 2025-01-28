# Copyright (c) 2024-2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with dataflow builder's specific utility functions."""

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Tuple, Union

from pipeline_manager.dataflow_builder.entities import (
    Interface,
    InterfaceConnection,
    Node,
)


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


def ensure_connection_is_absent(
    connection: Union[InterfaceConnection, str],
    connections: Dict[str, InterfaceConnection],
) -> None:
    """
    Check if a connection is absent. Otherwise, an exception is raised.

    Parameters
    ----------
    connection : Union[InterfaceConnection, str]
        Connection, which presence should be verified. If str is given,
            only part of check may be performed.
    connections : Dict[str, InterfaceConnection]
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

    if isinstance(connection, InterfaceConnection):
        if connection.id in connections:
            raise KeyError(
                f"Connection with id={connection.id} is present "
                "in a dataflow graph."
                "Connection with the identical id already exists."
            )

        common_source = filter_connections(
            "from_interface", connection.from_interface, connections
        )
        common_drain = filter_connections(
            "to_interface", connection.to_interface, connections
        )
        intersection = set(common_source).intersection(common_drain)
        if intersection:
            raise ValueError(
                "The connection between these two interfaces already exists: "
                + intersection
            )


def filter_connections(
    attribute_name: str,
    value: Any,
    connections: Dict[str, InterfaceConnection],
) -> List[str]:
    """
    Filter IDs of connection that match the supplied criterion.

    Parameters
    ----------
    attribute_name : str
        Name of the parameter, by which search should be conducted.
    value : Any
        Value of the parameter, which should be matched.
    connections : Dict[str, InterfaceConnection]
        Dictionary of all ids and connections.

    Returns
    -------
    List[str]
        List of IDs, where the attribute name matches the expected value.

    Raises
    ------
    ValueError
        Raised if the attribute name is not present in the
        `NodeConnection` class.
    """
    if attribute_name not in InterfaceConnection.__annotations__:
        raise ValueError(
            f"Unknown attribute name `{value}`. "
            f"Allowed values: {InterfaceConnection.__annotations__.keys()}"
        )

    filtered = [
        id
        for id, connection in connections.items()
        if getattr(connection, attribute_name) == value
    ]

    return filtered


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
        Text for better error messages. For example, `source` or `target`.

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


def get_interface_if_present(
    interface: Union[Interface, str], nodes: Dict[str, Node]
) -> Tuple[Interface, None]:
    """
    Get interface given it is present in the nodes of a dataflow graph.

    Parameters
    ----------
    interface : Union[Interface, str]
        `Interface` instance or id of the sought interface.
    nodes : Dict[str, Node]
        All nodes of the dataflow graph.

    Returns
    -------
    Tuple[Interface, None]
        Instance of `Interface` if it is present in the dataflow graph.
        Otherwise, `None`.
    """
    if isinstance(interface, Interface):
        interface = interface.id

    for _, node in nodes.items():
        for _interface in node.interfaces:
            if _interface.id == interface:
                return _interface

    return None
