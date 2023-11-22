# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import json
import asyncio
from importlib.resources import open_text

from pipeline_manager_backend_communication.communication_backend import (
    CommunicationBackend,
)

from pipeline_manager.resources import schemas


class PMStateManager:
    """
    Global state manager that should be used work with the application state.

    This class should not be imported directly, but rather
    `global_state_manager` object should be imported to use this class.
    """

    def __init__(
        self,
        tcp_server_port: int = 9000,
        tcp_server_host: str = "127.0.0.1",
    ) -> None:
        """
        Creates a state manager

        Parameters
        ----------
        tcp_server_port : int
            Application port that is going to be used for the
            TCP server socket.
        tcp_server_host : str
            IPv4 of the server that is going to be used for the
            TCP server socket.
        """
        self.tcp_server_port = tcp_server_port
        self.tcp_server_host = tcp_server_host
        self.server = None
        self.server_processes = []
        self.server_should_stop = False

        self.schema = None
        self.schema_filename = "unresolved_specification_schema.json"

        self.connected_frontends = 0

        # Semaphore used to request connecting to the external application
        # It is used so that different frontend instances do not interfere
        # with each other
        self.connecting_token = asyncio.Semaphore(1)

    async def reinitialize(
        self,
        tcp_server_port: int,
        tcp_server_host: str,
    ) -> None:
        """
        Reinitialize the configuration of the state

        Parameters
        ----------
        tcp_server_port : int
            Application port that is going to be used for the
            TCP server socket.
        tcp_server_host : str
            IPv4 of the server that is going to be used for the
            TCP server socket.
        """
        self.tcp_server_port = tcp_server_port
        self.tcp_server_host = tcp_server_host

        if self.server:
            await self.server.disconnect()
        self.server = None

    @property
    def tcp_server(self) -> CommunicationBackend:
        """
        Returns initialized CommunicationBackend

        Returns
        -------
        CommunicationBackend
            Initialized CommunicationBackend
        """
        if not self.server:
            self.server = CommunicationBackend(
                self.tcp_server_host, self.tcp_server_port
            )
        return self.server

    def get_schema(self) -> dict:
        """
        Returns dataflow specification schema

        Returns
        -------
        dict
            Dataflow specification schema
        """
        if not self.schema:
            with open_text(schemas, self.schema_filename) as f:
                self.schema = json.load(f)
        return self.schema


# Singleton-like object that should be imported
global_state_manager = PMStateManager()
