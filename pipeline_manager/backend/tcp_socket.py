# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import json
import asyncio
import threading
from typing import Dict
from socketio import AsyncServer

from pipeline_manager.backend.state_manager import global_state_manager
from pipeline_manager_backend_communication.misc_structures import Status
from pipeline_manager_backend_communication.communication_backend import CommunicationBackend  # noqa: E501

_THREAD: threading.Thread = None


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
    socketio : SocketIo
        WebSocket connected to frontend
    """
    while True:
        message = tcp_server.wait_for_message()
        if message.status == Status.DATA_READY:
            if isinstance(message.data[1], Dict):
                data = message.data[1]
            else:
                data = json.loads(
                    message.data[1].encode(tcp_server.encoding_format)
                )
            if message.data[0] is None:
                # Message has no method -- it is response
                event = 'api-response'
            else:
                # Message has methods -- it is request
                event = 'api'
            await socketio.emit(event, data)
        elif message.status == Status.CONNECTION_CLOSED:
            break


def start_socket_thread(socketio: AsyncServer):
    """
    Starts thread with function redirecting messages from external app
    to frontend.

    If previously satarted thread is still alive, exception will be raised.

    Parameters
    ----------
    socketio : SocketIo
        WebSocket connected to frontend
    """
    global _THREAD
    if _THREAD and _THREAD.is_alive():
        raise Exception("Previous thread is still alive")
    _THREAD = threading.Thread(
        target=lambda: asyncio.run(
            manage_socket_messages(global_state_manager.tcp_server, socketio)
        )
    )
    _THREAD.start()


def join_listener_thread():
    """
    Waits till end of the listener thread.
    """
    if _THREAD and _THREAD.is_alive():
        _THREAD.join()
