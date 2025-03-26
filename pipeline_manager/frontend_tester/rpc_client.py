"""Module with a RPC client for test purposes."""

import asyncio
import json
from pathlib import Path

from pipeline_manager_backend_communication.communication_backend import (
    CommunicationBackend,
)
from pipeline_manager_backend_communication.misc_structures import MessageType

host = "127.0.0.1"
port = 9000


class RPCMethods:
    """Class implementing RPC methods by having methods matching names."""

    def specification_get(self) -> dict:
        path = Path("./examples/sample-subgraph-specification.json")
        specification = {}
        with open(path, "rt") as fd:
            specification = json.load(fd)
        return {"type": MessageType.OK.value, "content": specification}

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
    await client.initialize_client(RPCMethods())
    await client.start_json_rpc_client()


loop = asyncio.get_event_loop()
loop.run_until_complete(run_rpc_client())
