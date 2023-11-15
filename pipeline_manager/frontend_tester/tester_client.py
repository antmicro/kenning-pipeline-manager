#!/usr/bin/env python3

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
import threading
import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Union
import sys

from pipeline_manager import frontend_tester
from pipeline_manager.utils.logger import string_to_verbosity

from pipeline_manager_backend_communication.communication_backend import (
    CommunicationBackend,
)
from pipeline_manager_backend_communication.misc_structures import (
    MessageType,
)

RUN = "RunBehaviour"
VALIDATE = "ValidationBehaviour"
SEND_REQUEST = "SendRequestToFrontend"


def get_node_properties(node_type: str, dataflow: Dict) -> Dict:
    """
    Function that reads properties of a `name` node in `dataflow`.
    It is assumed for now that we have only such node in the `dataflow`.

    Parameters
    ----------
    node_type : str
        Properties of the `name` node are going to be read and returned
        as a dictionary.
    dataflow : Dict
        Dataflow that was sent by Pipeline Manager.

    Returns
    -------
    Dict :
        Dictionary that has all properties of a `name` node.
    """
    nodes = dataflow["graph"]["nodes"]
    description_node = None

    for node in nodes:
        if node["name"] == node_type:
            description_node = node
            break

    properties = {}
    for prop in description_node["properties"]:
        properties[prop["name"]] = prop["value"]

    return properties


def get_effects(node_type: str, dataflow: Dict) -> List:
    """
    Function that returns all connected nodes to a `type`
    node in the dataflow.

    Parameters
    ----------
    node_type : str
        Nodes connected to the `type` node are returned.
    dataflow : Dict
        Dataflow that was sent by Pipeline Manager.

    Returns
    -------
    List :
        List of nodes connected to `type` node.
    """
    nodes = dataflow["graph"]["nodes"]
    connections = dataflow["graph"]["connections"]
    socket_id = None

    for node in nodes:
        if node["name"] == node_type:
            for io in node["interfaces"]:
                if io["direction"] == "output":
                    socket_id = io["id"]
                    break

    connected_nodes_id = []
    for connection in connections:
        if connection["from"] == socket_id:
            connected_nodes_id.append(connection["to"])

    connected_nodes = []
    for node in nodes:
        try:
            for io in node["interfaces"]:
                if io["name"] == "Effect":
                    if io["id"] in connected_nodes_id:
                        connected_nodes.append(node)
        except KeyError:
            pass

    parsed_nodes = []
    for node in connected_nodes:
        parsed_nodes.append(
            {
                "name": node["name"],
                "properties": {
                    prop["name"]: prop["value"] for prop in node["properties"]
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


class RPCMethods:
    def __init__(
        self,
        specification: Dict,
        client: CommunicationBackend,
        out_path: str
    ):
        self.specification = specification
        self.client = client
        self.out_path = out_path
        self.last_dataflow = None
        self.running = False

    def import_dataflow(self, dataflow: Dict) -> Dict:
        """
        RPC method that responses to Import request.

        Parameters
        ----------
        dataflow : Dict
            Content of the request.

        Returns
        -------
        Dict
            Method's response
        """
        return {'type': MessageType.OK.value, 'content': dataflow}

    def request_specification(self) -> Dict:
        """
        RPC method that responses to Specification request.

        Returns
        -------
        Dict
            Method's response
        """
        logging.log(logging.INFO, "Sending specification.")
        return {
            'type': MessageType.OK.value,
            'content': self.specification,
        }

    def run_dataflow(self, dataflow: Dict) -> Dict:
        """
        RPC method that responses to Run request.

        Parameters
        ----------
        dataflow : Dict
            Content of the request.

        Returns
        -------
        Dict
            Method's response
        """
        return self._run_validate_response([RUN, SEND_REQUEST], dataflow)

    def stop_dataflow(self) -> Dict:
        """
        RPC method that responses to Run request.

        Returns
        -------
        Dict
            Method's response
        """
        if self.last_dataflow is not None:
            properties = None
            try:
                properties = get_node_properties(
                    'StopBehaviour',
                    self.last_dataflow
                )
            except Exception:
                pass
            type = MessageType.OK.value
            content = "Everything went fine!"
            if properties is not None:
                if "MessageType" in properties:
                    type = _text_to_message_type(
                        properties["MessageType"]
                    ).value
                if "Message" in properties:
                    content = properties["Message"]
        self.running = False
        return {
            'type': type,
            'content': content
        }

    def validate_dataflow(self, dataflow: Dict) -> Dict:
        """
        RPC method that responses to Validate request.

        Parameters
        ----------
        dataflow : Dict
            Content of the request.

        Returns
        -------
        Dict
            Method's response
        """
        return self._run_validate_response(VALIDATE, dataflow)

    def _run_validate_response(
        self,
        title: Union[str, List[str]],
        data: Dict,
    ) -> Dict:
        """
        Method that responses to Run and Validation requests.

        Parameters
        ----------
        title : Union[str, List[str]]
            Message type of the request.
        data : bytes
            Content of the request.

        Returns
        -------
        Dict
            Method's response
        """
        self.last_dataflow = data
        if not isinstance(title, List):
            title = [title]
        properties = None
        found = None
        for t in title:
            try:
                properties = get_node_properties(t, data)
                found = t
            except Exception:
                continue
            break
        if not properties:
            raise Exception(f"No description for {title} provided")
        if properties["Disconnect"]:
            self.client.disconnect()
            return {}

        if found == RUN:
            self.running = True
            steps = properties["ProgressMessages"]
            time_offset = properties["Duration"] / steps
            for i in range(1, steps + 1):
                if not self.running:
                    break
                progress = i / steps * 100
                logging.log(logging.INFO, f"Progress: {progress}")
                self.client.notify('progress', {'progress': progress})
                time.sleep(time_offset)
        elif found == SEND_REQUEST:
            method = properties["Method"]
            params = json.loads(properties["Params"])
            response = self.client.request(method, params, non_blocking=False)
            if "result" in response:
                properties["Message"] = json.dumps(response["result"])
                properties["MessageType"] = "OK"
            else:
                properties["Message"] = json.dumps(response["error"])
                properties["MessageType"] = "ERROR"
        else:
            time.sleep(properties["Duration"])

        def delayed_effect(client, title, data):
            effects = get_effects(title, data)
            for effect in effects:
                if effect["name"] == "Disconnect":
                    if effect["properties"]["Should disconnect"]:
                        time.sleep(effect["properties"]["Time offset"])
                        logging.log(logging.INFO, "Disconnecting!")
                        client.disconnect()
        threading.Thread(
            target=delayed_effect, args=(self.client, found, data)
        ).start()

        if self.running:
            self.running = False
        return {
            'type': _text_to_message_type(properties["MessageType"]).value,
            'content': properties["Message"],
        }

    def export_dataflow(
        self,
        dataflow: Dict,
    ) -> Dict:
        """
        RPC method that responses to Export requests.

        Parameters
        ----------
        dataflow : Dict
            Content of the request.

        Returns
        -------
        Dict
            Method's response
        """
        node_type = "ExportBehaviour"
        try:
            properties = get_node_properties(node_type, dataflow)
        except Exception:
            raise Exception("No description for export_dataflow provided")
        if properties["Disconnect"]:
            self.client.disconnect()
            return {}

        time.sleep(properties["Duration"])

        with open(self.out_path, "w") as f:
            json.dump(dataflow, f, indent=4)
        logging.log(
            logging.INFO,
            f"Exported dataflow stored in {self.out_path}"
        )
        return {
            'type': _text_to_message_type(properties["MessageType"]).value,
            'content': properties["Message"],
        }


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

    if args.specification_path is None:
        spec_path = Path(frontend_tester.__file__).parent
        spec_path = spec_path / "frontend_tester_specification.json"
    else:
        spec_path = args.specification_path
    with open(spec_path) as f:
        specification = json.load(f)

    client = CommunicationBackend(args.host, args.port)
    client.initialize_client(RPCMethods(
        specification,
        client,
        args.output_path,
    ))

    client.start_json_rpc_client(separate_thread=True)
    client.client_thread.join()


if __name__ == "__main__":
    main(sys.argv)
