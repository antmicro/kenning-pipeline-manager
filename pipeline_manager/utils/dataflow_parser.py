# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Script that convert old dataflow format save file to a new one.
Usage of the script:

* python -m pipeline_manager.utils.dataflow_parser old_format_dataflow.json --output new_format_dataflow.json
"""


import argparse
import json
import random
import sys
from pathlib import Path
from typing import Any, NamedTuple, Optional


class Interface(NamedTuple):
    name: str
    id: str
    value: Any


class Connection(NamedTuple):
    id: str
    from_node: str
    to_node: str


class Node(NamedTuple):
    type: str
    id: str
    name: str
    parameters: list[Interface]
    inputs: list[Interface]
    outputs: list[Interface]
    pos_x: int
    pos_y: int
    width: int
    twoColumn: bool


def from_old(dataflow: dict) -> tuple[list[Node], list[Connection]]:
    """
    Parses dataflow saved in format version-1 so that it can be converted
    into a version-2.

    Parameters
    ----------
    dataflow : dict
        Saved dataflow in format version-1.

    Returns
    -------
    tuple[list[Node], list[Connection]]:
        Parsed nodes and connections.
    """
    nodes = dataflow["nodes"]
    connections = dataflow["connections"]

    parsed_connections = []
    for conn in connections:
        parsed_connections.append(Connection(conn["id"], conn["from"], conn["to"]))

    parsed_nodes = []
    for node in nodes:
        parameters = []
        for option in node["options"]:
            name, value = option
            parameters.append(Interface(name, get_id(), value))

        inputs = []
        outputs = []
        for interface in node["interfaces"]:
            name, state = interface
            if state["isInput"]:
                inputs.append(Interface(name, state["id"], ""))
            else:
                outputs.append(Interface(name, state["id"], ""))

        parsed_nodes.append(
            Node(
                node["type"],
                node["id"],
                node["name"],
                parameters,
                inputs,
                outputs,
                node["position"]["x"],
                node["position"]["y"],
                node["width"],
                node["twoColumn"],
            )
        )

    return parsed_nodes, parsed_connections


def get_id(size: Optional[int] = 10) -> str:
    """
    Generates a random id that consists of digits only.

    Parameters
    ----------
    size : Optional[int]
        Size of the id

    Returns
    -------
    str
        Generated id
    """
    return "".join([str(random.choice(range(9))) for _ in range(size)])


def to_new(nodes: list[Node], connections: list[Connection]) -> dict:
    """
    Generates a valid save in a dataflow format version-2 from
    given arguments. 

    Parameters
    ----------
    nodes : list[Node]
        Parsed nodes
    connections : list[Connection]
        Parsed connections

    Returns
    -------
    dict
        Converted dataflow save in version-2
    """
    return {
        "graphTemplates": [],
        "graph": {
            "id": get_id(),
            "nodes": [
                {
                    "type": node.type,
                    "id": node.id,
                    "title": node.name,
                    "position": {"x": node.pos_x, "y": node.pos_y},
                    "inputs": {
                        parameter.name: {"id": parameter.id, "value": parameter.value}
                        for parameter in node.parameters + node.inputs
                    },
                    "outputs": {
                        parameter.name: {
                            "id": parameter.id,
                        }
                        for parameter in node.outputs
                    },
                    "width": node.width,
                    "twoColumn": node.twoColumn,
                }
                for node in nodes
            ],
            "connections": [
                {"id": conn.id, "from": conn.from_node, "to": conn.to_node}
                for conn in connections
            ],
            "inputs": [],
            "outputs": [],
        },
    }


def main(argv):
    parser = argparse.ArgumentParser(argv[0])
    parser.add_argument("dataflow", type=Path)
    parser.add_argument("--output", type=Path, default="parsed.json")
    parser.add_argument("--old-to-new", action="store_false")

    args, _ = parser.parse_known_args(argv[1:])

    with open(args.dataflow, "r") as f:
        dataflow = json.load(f)

    nodes, connections = from_old(dataflow)
    new_dataflow = to_new(nodes, connections)

    with open(args.output, "w") as f:
        json.dump(new_dataflow, f)


if __name__ == "__main__":
    main(sys.argv)
