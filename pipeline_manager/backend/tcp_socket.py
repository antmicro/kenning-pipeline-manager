# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Provides methods for communication between the server and
third-party application.
"""

import asyncio
import json
from typing import Dict

from jsonrpc.jsonrpc2 import JSONRPC20Response
from pipeline_manager_backend_communication.communication_backend import (
    CommunicationBackend,  # noqa: E501
)
from pipeline_manager_backend_communication.misc_structures import (  # noqa: E501
    CustomErrorCode,
    Status,
)
from socketio import AsyncServer

from pipeline_manager.backend.state_manager import global_state_manager

_TASK: asyncio.Task = None


async def manage_socket_messages(
    tcp_server: CommunicationBackend,
    socketio: AsyncServer,
):
    """
    Function receiving messages from socket and redirecting it to WebSocket.

    It runs as long as socket is connected.

    Parameters
    ----------
    tcp_server : CommunicationBackend
        Server managing socket
    socketio : AsyncServer
        WebSocket connected to frontend
    """
    while True:
        message = await tcp_server.wait_for_message()
        if message.status == Status.DATA_READY:
            if isinstance(message.data[1], Dict):
                data = message.data[1]
            else:
                data = json.loads(
                    message.data[1].encode(tcp_server.encoding_format)
                )

            # Send error response if frontend is not connected
            if global_state_manager.connected_frontends == 0 and "id" in data:
                tcp_server.send_jsonrpc_message(
                    JSONRPC20Response(
                        _id=data["id"],
                        error={
                            "code": CustomErrorCode.EXTERNAL_APPLICATION_NOT_CONNECTED.value,  # noqa: E501
                            "message": "Application is not connected",
                        },
                    ).data
                )

            if message.data[0] is None:
                # Message has no method -- it is response
                event = "api-response"
                key = "result"
            else:
                # Message has methods -- it is request
                event = "api"
                key = "params"
            # Get Session ID or fallback to the newest one
            if "error" in data:
                key = "error"
            if key in data and "sid" in data[key]:
                sid = data[key].pop("sid")
                data[key] = data[key][key]
            else:
                sid = global_state_manager.last_socket

            await socketio.emit(event, data, to=sid)
        elif message.status == Status.CONNECTION_CLOSED:
            break


def start_socket_task(
    socketio: AsyncServer,
):
    """
    Starts thread with function redirecting messages from external app
    to frontend.

    If previously satarted thread is still alive, exception will be raised.

    Parameters
    ----------
    socketio : AsyncServer
        WebSocket connected to frontend

    Raises
    ------
    Exception
        Raised when the previous listener is still alive
    """
    global _TASK
    if _TASK and not _TASK.done():
        raise Exception("Previous listener is still alive")
    _TASK = asyncio.create_task(
        manage_socket_messages(global_state_manager.tcp_server, socketio)
    )


async def join_listener_task():
    """
    Waits till end of the listener thread.
    """
    if _TASK and not _TASK.done():
        await _TASK
