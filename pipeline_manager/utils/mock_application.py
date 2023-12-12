# Copyright (c) 2020-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import asyncio
import socketio
from typing import Dict

from pipeline_manager_backend_communication.communication_backend import CommunicationBackend  # noqa: E501
from pipeline_manager_backend_communication.misc_structures import MessageType, Status  # noqa: E501


class MockApplicationClient(object):
    """
    Mock Application class that is used to communicate with backend TCP server
    and test its endpoints.

    This application is not meant to perform any sophisticated processing.
    """

    def __init__(
            self,
            host: str,
            backend_port: int,
            external_port: int,
            sample_specification: dict,
            sample_dataflow: dict) -> None:
        """
        Parameters
        ----------
        host : str
            IPv4 of the TCP server socket to connect to.
        backend_port : int
            Application port of the backend server
        external_port : int
            Application port of the TCP server socket
        sample_specification : dict
            Sample specification that is used to handle
            SPECIFICATION messages type.
        sample_dataflow : dict
            Sample dataflow that is used to handle
            IMPORT messages type.
        """
        self.host = host
        self.backend_port = backend_port
        self.external_port = external_port
        self.sample_specification = sample_specification
        self.sample_dataflow = sample_dataflow

        self.sio = socketio.AsyncSimpleClient()

        self.connecting_time_offset = 0.1
        self.client = CommunicationBackend(host, external_port)

    async def connect_socketio(self):
        """
        Function that connects SocketIO client to backend server.
        """
        await self.sio.connect(f'http://{self.host}:{self.backend_port}')

    async def try_connecting(self) -> None:
        """
        Function that tries to connect to TCP server.

        If it fails to connect because the TCP server socker is closed
        it retries to connect every `self.connecting_time_offset` seconds
        until success.
        """
        while True:
            try:
                out = await self.client.initialize_client(
                    self.Methods(self.sample_specification))
                if out.status == Status.CLIENT_CONNECTED:
                    return
            except ConnectionRefusedError:
                await asyncio.sleep(self.connecting_time_offset)

    async def answer_valid(self) -> None:
        """
        Waits for an incoming message, reads it and based on the
        `MessageType` sends an appropriate message.

        It is used to simulate a regular application that waits for requests.
        """
        status, message = await self.client.wait_for_message()
        if status == Status.DATA_READY:
            sid = message[1]['params'].pop('sid')
            response = await self.client.generate_json_rpc_response(message[1])
            await self.client.send_jsonrpc_message_with_sid(response.data, sid)

    class Methods:
        """
        Class containing all JSON-RPC methods of Mocked Application.
        """

        def __init__(self, sample_specification):
            self.sample_specification = sample_specification

        def dataflow_validate(self, dataflow: Dict) -> Dict:
            return {'type': MessageType.OK.value}

        def specification_get(self) -> Dict:
            return {
                'type': MessageType.OK.value,
                'content': self.sample_specification,
            }

        def dataflow_run(self, dataflow: Dict) -> Dict:
            return {'type': MessageType.OK.value}

        def dataflow_stop(self) -> Dict:
            return {'type': MessageType.OK.value}

        def dataflow_import(self, external_application_dataflow: Dict) -> Dict:
            return {
                'type': MessageType.OK.value,
                'content': self.sample_specification,
            }

        def dataflow_export(self, dataflow: Dict) -> Dict:
            return {'type': MessageType.OK.value}

    async def emit(self, event: str, data: Dict) -> Dict:
        """
        Emits request and waits for the response.

        Parameters
        ----------
        event : str
            Name of the event that should be emitted
        data : Dict
            Content of the emitted request

        Returns
        -------
        Dict
            Response to the emmited request
        """
        await self.sio.emit(event, data)
        response = await self.sio.receive()
        return response[1]

    async def disconnect(self) -> None:
        """
        Disconnects the application from the TCP server.
        """
        await self.client.disconnect()
