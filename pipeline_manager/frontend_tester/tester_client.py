#!/usr/bin/env python

# Copyright (c) 2020-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Module used to test frontend part of Pipeline Manager.

It simulates behaviour of a regular external application, by allowing
to choose how it responds to different requests and message types.

Run in the root directory:
```bash
python -m pipeline_manager.frontend_tester.tester_client
```

It support all MessageTypes.

* MessageType.VALIDATION, MessageType.RUN and MessageType.EXPORT - Frontend
tester checks appropriate nodes in the dataflow, that are customizable and can
be adjusted to change the behaviour of the application.

* MessageType.SPECIFICATION - Frontend tester sends OK response that contains
its specification

* MessageType.IMPORT - Frontend tester sends OK response that contains the
data sent to it. It simply returns a received file.
"""

import argparse
import json
import logging
import time
from pathlib import Path
from typing import Dict, List
import sys

from pipeline_manager import frontend_tester
from pipeline_manager.utils.logger import string_to_verbosity

from pipeline_manager_backend_communication.communication_backend import (
    CommunicationBackend,
)  # noqa: E501
from pipeline_manager_backend_communication.misc_structures import (
    MessageType,
)  # noqa: E501


def get_node_properties(title: str, dataflow: Dict) -> Dict:
    """
    Function that reads properties of a `title` node in `dataflow`.
    It is assumed for now that we have only such node in the `dataflow`.

    Parameters
    ----------
    title : str
        Properties of the `title` node are going to be read and returned
        as a dictionary.
    dataflow : Dict
        Dataflow that was sent by Pipeline Manager.

    Returns
    -------
    Dict :
        Dictionary that has all properties of a `title` node.
    """
    dataflow = json.loads(dataflow)
    nodes = dataflow["graph"]["nodes"]
    description_node = None

    for node in nodes:
        if node["title"] == title:
            description_node = node
            break

    properties = {}
    for title, state in description_node["properties"].items():
        properties[title] = state["value"]

    return properties


def get_effects(title: str, dataflow: Dict) -> List:
    """
    Function that returns all connected nodes to a `title`
    node in the dataflow.

    Parameters
    ----------
    title : str
        Nodes connected to the `title` node are returned.
    dataflow : Dict
        Dataflow that was sent by Pipeline Manager.

    Returns
    -------
    List :
        List of nodes connected to `title` node.
    """
    dataflow = json.loads(dataflow)
    nodes = dataflow["graph"]["nodes"]
    connections = dataflow["graph"]["connections"]
    socket_id = None

    for node in nodes:
        if node["title"] == title:
            socket_id = node["outputs"]["Effect"]["id"]
            break

    connected_nodes_id = []
    for connection in connections:
        if connection["from"] == socket_id:
            connected_nodes_id.append(connection["to"])

    connected_nodes = []
    for node in nodes:
        try:
            if node["inputs"]["Effect"]["id"] in connected_nodes_id:
                connected_nodes.append(node)
        except KeyError:
            pass

    parsed_nodes = []
    for node in connected_nodes:
        parsed_nodes.append(
            {
                "title": node["title"],
                "properties": {
                    name: properties["value"]
                    for name, properties in node["properties"].items()
                },
            }
        )
    return parsed_nodes


def _text_to_message_type(text: str) -> MessageType:
    """
    Helper function that maps text representation to MessageType.

    Parameters
    ----------
    text : str
        Text representation of a message type

    Returns
    -------
    MessageType :
        Mapped text representation
    """
    return {"OK": MessageType.OK, "ERROR": MessageType.ERROR}[text]


def import_response(
    message_type: MessageType, data: bytes, client: CommunicationBackend
) -> None:
    """
    Callback that responses to Import request.

    Parameters
    ----------
    message_type : MessageType
        Message type of the request.
    data : bytes
        Content of the request.
    client : CommunicationBackend
        Client connected to Pipeline Manager
    """
    client.send_message(MessageType.OK, data)


def specification_response(
    message_type: MessageType,
    data: bytes,
    client: CommunicationBackend,
    specification: Dict,
) -> None:
    """
    Callback that responses to Specification request.

    Parameters
    ----------
    message_type : MessageType
        Message type of the request.
    data : bytes
        Content of the request.
    client : CommunicationBackend
        Client connected to Pipeline Manager
    specification : Dict
        Specification that is send back to Pipeline Manager
    """
    logging.log(logging.INFO, "Sending specification.")
    client.send_message(
        MessageType.OK, json.dumps(specification).encode(encoding="UTF-8")
    )


def run_validate_response(
    message_type: MessageType,
    data: bytes,
    client: CommunicationBackend,
) -> None:
    """
    Callback that responses to Run and Validation requests.

    Parameters
    ----------
    message_type : MessageType
        Message type of the request.
    data : bytes
        Content of the request.
    client : CommunicationBackend
        Client connected to Pipeline Manager
    """
    message_type_to_node_title = {
        MessageType.RUN: "RunBehaviour",
        MessageType.VALIDATE: "ValidationBehaviour",
    }

    try:
        title = message_type_to_node_title[message_type]
        properties = get_node_properties(title, data)
    except Exception:
        client.send_message(
            MessageType.ERROR,
            f"No description for {str(message_type)} provided".encode(encoding="UTF-8"),  # noqa: E501
        )
        return
    if properties["Disconnect"]:
        client.disconnect()
        return

    if message_type == MessageType.RUN:
        steps = properties["ProgressMessages"]
        time_offset = properties["Duration"] / steps
        for i in range(1, steps + 1):
            progress = str(i / steps * 100)
            logging.log(logging.INFO, f"Progress: {progress}")
            client.send_message(MessageType.PROGRESS, progress.encode("UTF-8"))
            time.sleep(time_offset)
    else:
        time.sleep(properties["Duration"])

    client.send_message(
        _text_to_message_type(properties["MessageType"]),
        properties["Message"].encode(encoding="UTF-8"),
    )

    effects = get_effects(title, data)
    for effect in effects:
        if effect["title"] == "Disconnect":
            if effect["properties"]["Should disconnect"]:
                time.sleep(effect["properties"]["Time offset"])
                logging.log(logging.INFO, "Disconnecting!")
                client.disconnect()


def export_response(
    message_type: MessageType,
    data: bytes,
    client: CommunicationBackend,
    output_path: Path,
) -> None:
    """
    Callback that responses to Export requests.

    Parameters
    ----------
    message_type : MessageType
        Message type of the request.
    data : bytes
        Content of the request.
    client : CommunicationBackend
        Client connected to Pipeline Manager
    output_path : Path
        Path where the exported dataflow is saved.
    """
    title = "ExportBehaviour"
    try:
        properties = get_node_properties(title, data)
    except Exception:
        client.send_message(
            MessageType.ERROR,
            f"No description for {str(message_type)} provided".encode(encoding="UTF-8"),  # noqa: E501
        )
        return
    if properties["Disconnect"]:
        client.disconnect()
        return

    time.sleep(properties["Duration"])

    with open(output_path, "w") as f:
        json.dump(json.loads(data), f, indent=4)
    logging.log(logging.INFO, f"Exported dataflow stored in {output_path}")
    client.send_message(
        _text_to_message_type(properties["MessageType"]),
        properties["Message"].encode(encoding="UTF-8"),
    )


def main(argv):
    parser = argparse.ArgumentParser(argv[0])
    parser.add_argument(
        "--host",
        type=str,
        help="The address of the Pipeline Manager Server",
        default="127.0.0.1",
    )
    parser.add_argument(
        "--port",
        type=int,
        help="The port of the Pipeline Manager Server",
        default=9000,
    )
    parser.add_argument(
        "--output-path",
        type=Path,
        help="Path were exported dataflows are saved",
        default="output.json",
    )
    parser.add_argument(
        "--verbosity",
        help="Verbosity level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default="DEBUG",
        type=str,
    )
    parser.add_argument(
        "--specification-path",
        type=Path,
        help="Path to specification JSON file",
        default=None,
    )
    args, _ = parser.parse_known_args(argv[1:])
    logging.basicConfig(level=string_to_verbosity(args.verbosity))

    client = CommunicationBackend(args.host, args.port)
    client.initialize_client()

    if args.specification_path is None:
        spec_path = Path(frontend_tester.__file__).parent
        spec_path = spec_path / "frontend_tester_specification.json"
    else:
        spec_path = args.specification_path
    with open(spec_path) as f:
        specification = json.load(f)

    client.register_callback(MessageType.IMPORT, import_response)
    client.register_callback(
        MessageType.SPECIFICATION, specification_response, specification
    )
    client.register_callback(MessageType.RUN, run_validate_response)
    client.register_callback(MessageType.VALIDATE, run_validate_response)
    client.register_callback(
        MessageType.EXPORT,
        export_response,
        args.output_path
    )

    while client.connected:
        _, _ = client.wait_for_message()


if __name__ == "__main__":
    main(sys.argv)
