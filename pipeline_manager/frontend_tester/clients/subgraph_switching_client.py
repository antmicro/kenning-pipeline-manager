"""Module with a RPC client for test purposes."""

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, List

from pipeline_manager_backend_communication.communication_backend import (
    CommunicationBackend,
)
from pipeline_manager_backend_communication.misc_structures import MessageType

host = "127.0.0.1"
port = 9876


class RPCMethods:
    """Class implementing RPC methods by having methods matching names."""

    def __init__(self, client: CommunicationBackend):
        self.client = client

    def specification_get(self) -> dict:
        path = Path("./examples/sample-subgraph-specification.json")
        specification = {}
        with open(path, "rt") as fd:
            specification = json.load(fd)
        return {"type": MessageType.OK.value, "content": specification}

    def dialog_boxes_get(self) -> object:
        return {
            "userDialog": {
                "title": "Task init",
                "confirmText": "Ok",
                "template": {"taskName": {"name": "task", "type": "text"}},
            }
        }

    def app_capabilities_get(self) -> List:
        return [
            {
                "name": "Open user dialog",
                "iconName": "Run",
                "procedureName": "custom_open_user_dialog_box",
            }
        ]

    async def custom_open_user_dialog_box(self, dataflow: Dict) -> Dict:
        await self.client.request(
            "open_dialog_request",
            {"title": "userDialog"},
        )
        return {"type": MessageType.OK.value, "content": "Dialog box open"}

    def user_dialog_read(self, data: object) -> None:
        taskName = data["taskName"]
        sys.stdout.write(f"Task: {taskName}")
        sys.stdout.flush()

    # Method's parameters have to match with received message.
    # **kwargs are used to get all received parameters.
    def dataflow_validate(self, dataflow: dict) -> dict:
        return {"type": MessageType.OK.value}

    def dataflow_run(self, dataflow: dict) -> dict:
        return {"type": MessageType.OK.value}

    def dataflow_stop(self) -> dict:
        return {"type": MessageType.OK.value}

    def dataflow_export(self, dataflow: dict) -> dict:
        return {"type": MessageType.OK.value, "content": dataflow}

    def dataflow_import(self, **kwargs) -> dict:
        return {
            "type": MessageType.OK.value,
            "content": kwargs["external_application_dataflow"],
        }


async def run_rpc_client():
    """Run a RPC client with the default settings."""
    client = CommunicationBackend(host, port)
    await client.initialize_client(RPCMethods(client))
    await client.start_json_rpc_client()


asyncio.run(run_rpc_client())
