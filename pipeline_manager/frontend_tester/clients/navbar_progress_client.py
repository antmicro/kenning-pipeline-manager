# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Module with a RPC client providing navbar buttons for progress tests.
"""

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

    def __init__(self, client: CommunicationBackend):
        self.client = client
        self.release = asyncio.Event()

    def specification_get(self) -> dict:
        path = Path("./examples/sample-specification.json")
        with open(path, "rt") as fd:
            specification = json.load(fd)
        return {"type": MessageType.OK.value, "content": specification}

    def app_capabilities_get(self) -> list:
        return [
            {
                "name": "Long task",
                "iconName": "Run",
                "procedureName": "custom_long_task",
                "allowToRunInParallelWith": ["custom_release"],
            },
            {
                "name": "Blocked task",
                "iconName": "Run",
                "procedureName": "custom_blocked_task",
            },
            {
                "name": "Release",
                "iconName": "Validate",
                "procedureName": "custom_release",
            },
        ]

    async def custom_long_task(self, dataflow: dict) -> dict:
        self.release.clear()
        await self.client.notify(
            "progress_change", {"progress": 50, "method": "custom_long_task"}
        )
        await self.release.wait()
        return {"type": MessageType.OK.value}

    def custom_blocked_task(self, dataflow: dict) -> dict:
        return {"type": MessageType.OK.value}

    def custom_release(self, dataflow: dict) -> dict:
        self.release.set()
        return {"type": MessageType.OK.value}


async def run_rpc_client():
    """Run a RPC client with the default settings."""
    client = CommunicationBackend(host, port)
    await client.initialize_client(RPCMethods(client))
    await client.start_json_rpc_client()


if __name__ == "__main__":
    asyncio.run(run_rpc_client())
