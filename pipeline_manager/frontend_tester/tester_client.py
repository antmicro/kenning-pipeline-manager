#!/usr/bin/env python3

# Copyright (c) 2020-2024 Antmicro <www.antmicro.com>
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
import asyncio
import json
import logging
import random
import string
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from queue import Queue
from threading import Thread
from typing import Dict, List, Union

import pexpect
from pipeline_manager_backend_communication.communication_backend import (
    CommunicationBackend,
)
from pipeline_manager_backend_communication.misc_structures import (
    MessageType,
)
from pipeline_manager_backend_communication.utils import (
    convert_message_to_string,
)

from pipeline_manager import frontend_tester
from pipeline_manager.utils.logger import string_to_verbosity

RUN = "RunBehaviour"
VALIDATE = "ValidationBehaviour"
SEND_REQUEST = "SendRequestToFrontend"
STRESS_TEST_REQUEST = "TerminalStressTest"


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
    Dict
        Dictionary that has all properties of a `name` node.
    """
    nodes = [node for graph in dataflow["graphs"] for node in graph["nodes"]]
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
    List
        List of nodes connected to `type` node.
    """
    nodes = [node for graph in dataflow["graphs"] for node in graph["nodes"]]
    connections = [
        connection
        for graph in dataflow["graphs"]
        for connection in graph["connections"]
    ]

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
    MessageType
        Mapped text representation
    """
    return {"OK": MessageType.OK, "ERROR": MessageType.ERROR}[text]


class RPCMethods:
    """
    Implementation of RPC callbacks.
    """

    WRITABLE_TERMINAL = "WritableTerminal"

    def __init__(
        self,
        specification: Dict,
        dataflow: Dict,
        client: CommunicationBackend,
        out_path: str,
    ):
        self.specification = specification
        self.default_dataflow = dataflow
        self.client = client
        self.out_path = out_path
        self.last_dataflow = None
        self.running = defaultdict(lambda: False)

        self.run = True
        self.input_queue = Queue(-1)
        self.loop = asyncio.get_event_loop()
        self.reader_thread = None

    def writable_terminal_management(self):
        """
        Manages subprocess input and output.
        """
        shell = pexpect.spawn("bash")
        while self.run:
            if not self.input_queue.empty():
                shell.send(self.input_queue.get(False))
            try:
                char = shell.read_nonblocking(1024, timeout=0.1)
                asyncio.run_coroutine_threadsafe(
                    self.client.request(
                        "terminal_write",
                        {
                            "name": self.WRITABLE_TERMINAL,
                            "message": char.decode(errors="replace"),
                        },
                    ),
                    self.loop,
                )
            except pexpect.exceptions.TIMEOUT:
                pass
            except pexpect.exceptions.EOF:
                shell.close()
                return

    async def start_writable_terminal(self) -> Dict:
        """
        Creates a new writable terminal, if it hasn't been opened yet.

        Returns
        -------
        Dict
            Message whether the terminal is created and running
        """
        if self.reader_thread:
            if self.reader_thread.is_alive():
                return {
                    "type": MessageType.ERROR.value,
                    "content": "Writable terminal already exists",
                }
            else:
                self.reader_thread.join()
        self.reader_thread = Thread(target=self.writable_terminal_management)
        self.reader_thread.start()
        await self.client.request(
            "terminal_add", {"name": self.WRITABLE_TERMINAL, "readonly": False}
        )
        return {"type": MessageType.OK.value, "content": "Terminal created"}

    def terminal_read(
        self,
        name: str,
        message: str,
    ) -> None:
        """
        RPC method providing messages from writable terminal.

        Parameters
        ----------
        name : str
            Name of te terminal
        message : str
            Terminal input
        """
        if name != self.WRITABLE_TERMINAL:
            logging.warn("Input from readonly terminal!")
            return
        self.input_queue.put(message)

    def app_capabilities_get(self) -> Dict:
        """
        RPC method that responses to App Capabalities request.

        Returns
        -------
        Dict
            Application capabalities
        """
        return {
            "stoppable_methods": [
                "dataflow_run",
                "custom_terminal_stress_test",
            ],
        }

    def dataflow_import(
        self,
        external_application_dataflow: str,
        mime: str,
        base64: bool,
    ) -> Dict:
        """
        RPC method that responses to Import request.

        Parameters
        ----------
        external_application_dataflow : str
            Content of the request.
        mime : str
            MIME type.
        base64 : bool
            Whether dataflow is in base64 format.

        Returns
        -------
        Dict
            Method's response
        """
        dataflow = convert_message_to_string(
            external_application_dataflow,
            base64,
            mime,
        )
        dataflow = json.loads(dataflow)
        return {
            "type": MessageType.OK.value,
            "content": dataflow,
        }

    def specification_get(self) -> Dict:
        """
        RPC method that responses to Specification request.

        Returns
        -------
        Dict
            Method's response
        """
        logging.log(logging.INFO, "Sending specification.")
        return {
            "type": MessageType.OK.value,
            "content": self.specification,
        }

    def dataflow_run(self, dataflow: Dict) -> Dict:
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
        return self._run_validate_response(
            RUN,
            dataflow,
            self.dataflow_run.__name__,
        )

    def dataflow_stop(self, method: str) -> Dict:
        """
        RPC method that responses to Run request.

        Parameters
        ----------
        method : str
            Name of the method that should be stopped.

        Returns
        -------
        Dict
            Method's response
        """
        if (
            method != self.dataflow_run.__name__
            and method != self.custom_terminal_stress_test.__name__
        ):
            return {
                "type": MessageType.ERROR.value,
                "content": "Only dataflow_run can be stopped",
            }
        if self.last_dataflow is not None:
            properties = None
            try:
                properties = get_node_properties(
                    "StopBehaviour", self.last_dataflow
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
        self.running[method] = False
        return {"type": type, "content": content}

    def dataflow_validate(self, dataflow: Dict) -> Dict:
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
        return self._run_validate_response(
            VALIDATE,
            dataflow,
            self.dataflow_validate.__name__,
        )

    def custom_terminal_stress_test(self, dataflow: Dict) -> Dict:
        """
        RPC method that sends random messages to a chosen terminal.

        Parameters
        ----------
        dataflow : Dict
            Content of the request.

        Returns
        -------
        Dict
            Method's response
        """
        return self._run_validate_response(
            STRESS_TEST_REQUEST,
            dataflow,
            self.custom_terminal_stress_test.__name__,
        )

    async def custom_create_writable_terminal(self, dataflow: Dict) -> Dict:
        """
        RPC method that creates writable terminal.

        Parameters
        ----------
        dataflow : Dict
            Content of the request.

        Returns
        -------
        Dict
            Method's response
        """
        return await self.start_writable_terminal()

    def custom_api_test(self, dataflow: Dict) -> Dict:
        """
        RPC method that responses to custom button Run API.

        Parameters
        ----------
        dataflow : Dict
            Content of the request.

        Returns
        -------
        Dict
            Method's response
        """
        return self._run_validate_response(
            SEND_REQUEST,
            dataflow,
            self.custom_api_test.__name__,
        )

    async def _run_validate_response(
        self,
        title: Union[str, List[str]],
        data: Dict,
        method_name: str,
    ) -> Dict:
        """
        Method that responses to Run and Validation requests.

        Parameters
        ----------
        title : Union[str, List[str]]
            Message type of the request.
        data : Dict
            Content of the request.
        method_name : str
            Name of the method used to start this job

        Returns
        -------
        Dict
            Method's response

        Raises
        ------
        Exception
           Raised when any of the fields in Validation node are incorrect
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
        if "Disconnect" in properties and properties["Disconnect"]:
            await self.client.disconnect()
            return {}

        if found == STRESS_TEST_REQUEST:
            self.running[method_name] = True
            terminal_name = properties["TerminalName"]
            message_length = properties["MessageLength"]
            rate = properties["MessagesPerSecond"]
            add_message_id = properties["AddMessageID"]

            await self.client.notify(
                "progress_change", {"progress": -1, "method": method_name}
            )

            counter = 0
            while self.running[method_name]:
                random_message = "".join(
                    random.choices(
                        list(string.ascii_uppercase + string.digits)
                        + ["\r\n"],
                        k=message_length,
                    )
                )
                if add_message_id:
                    curr_time = datetime.now().strftime("%H:%M:%S.%f")
                    random_message = f"\r\nMessage {counter} [{curr_time}] :  {random_message}"  # noqa: E501
                await self.client.notify(
                    "terminal_write",
                    {"name": terminal_name, "message": random_message},
                )
                counter += 1
                await asyncio.sleep(1 / rate)
        elif found == RUN:
            self.running[method_name] = True
            steps = properties["ProgressMessages"]
            time_offset = properties["Duration"] / steps
            for i in range(1, steps + 1):
                if not self.running[method_name]:
                    break
                progress = i / steps * 100
                logging.log(logging.INFO, f"Progress: {progress}")
                await self.client.notify(
                    "progress_change",
                    {"progress": progress, "method": method_name},
                )
                await asyncio.sleep(time_offset)
        elif found == SEND_REQUEST:
            method = properties["Method"]
            params = json.loads(properties["Params"])
            response = await self.client.request(method, params)
            if "result" in response:
                properties["Message"] = json.dumps(response["result"])
                properties["MessageType"] = "OK"
            else:
                properties["Message"] = json.dumps(response["error"])
                properties["MessageType"] = "ERROR"
        elif found == VALIDATE:
            await self.client.notify(
                "progress_change", {"progress": -1, "method": method_name}
            )
            await asyncio.sleep(properties["Duration"])
        else:
            await asyncio.sleep(properties["Duration"])

        async def delayed_effect(client, title, data):
            effects = get_effects(title, data)
            for effect in effects:
                if effect["name"] == "Disconnect":
                    if effect["properties"]["Should disconnect"]:
                        await asyncio.sleep(
                            effect["properties"]["Time offset"]
                        )
                        logging.log(logging.INFO, "Disconnecting!")
                        await client.disconnect()

        asyncio.create_task(delayed_effect(self.client, found, data))

        if self.running[method_name]:
            self.running[method_name] = False

        if "MessageType" in properties and "Message" in properties:
            return {
                "type": _text_to_message_type(properties["MessageType"]).value,
                "content": properties["Message"],
            }
        return {
            "type": _text_to_message_type("OK").value,
            "content": "No message provided",
        }

    async def dataflow_export(
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

        Raises
        ------
        Exception
            Raised when no data for exporting is provided
        """
        node_type = "ExportBehaviour"
        try:
            properties = get_node_properties(node_type, dataflow)
        except Exception:
            raise Exception("No description for dataflow_export provided")
        if properties["Disconnect"]:
            self.client.disconnect()
            return {}

        await asyncio.sleep(properties["Duration"])

        with open(self.out_path, "w") as f:
            json.dump(dataflow, f, indent=4)
        logging.log(
            logging.INFO, f"Exported dataflow stored in {self.out_path}"
        )
        return {
            "type": _text_to_message_type(properties["MessageType"]).value,
            "content": dataflow,
            "filename": properties["DefaultFilename"]
            if "DefaultFilename" in properties
            else "pipeline.json",
        }

    async def frontend_on_connect(self) -> Dict:
        """
        RPC method that responses to frontend_on_connect request.

        Initialize default dataflow.

        Returns
        -------
        Dict
            Method's response

        Raises
        ------
        Exception
            Raised when error is returned in the response
        """
        response = await self.client.request(
            "graph_change", {"dataflow": self.default_dataflow},
        )
        if "error" in response:
            raise Exception(response["error"]["message"])
        return {}


def main(argv):  # noqa: D103
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
        default=(
            Path(frontend_tester.__file__).parent
            / "frontend_tester_specification.json"
        ),
    )
    parser.add_argument(
        "--default-dataflow-path",
        type=Path,
        help="Path to dataflow JSON file",
        default=(
            Path(frontend_tester.__file__).parent
            / "frontend_tester_dataflow.json"
        ),
    )
    args, _ = parser.parse_known_args(argv[1:])
    logging.basicConfig(level=string_to_verbosity(args.verbosity))

    asyncio.run(_main(args))


async def _main(args: argparse.Namespace):
    spec_path = args.specification_path
    dataflow_path = args.default_dataflow_path
    with spec_path.open() as f:
        specification = json.load(f)
    with dataflow_path.open() as f:
        dataflow = json.load(f)

    client = CommunicationBackend(
        args.host,
        args.port,
        add_signal_handler=True,
    )
    methods = RPCMethods(
        specification,
        dataflow,
        client,
        args.output_path,
    )
    await client.initialize_client(methods)

    try:
        await client.start_json_rpc_client()
    finally:
        methods.run = False


if __name__ == "__main__":
    main(sys.argv)
