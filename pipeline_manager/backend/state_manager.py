# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Provides a singleton class representing the state of Pipeline Manager server.
"""

import asyncio
import json
from importlib.resources import open_text
from typing import Optional

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
        Creates a state manager.

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

        self._connected_sockets = []

        # Semaphore used to request connecting to the external application
        # It is used so that different frontend instances do not interfere
        # with each other, initialized on server startup
        self.connecting_token: Optional[asyncio.Semaphore] = None

    async def reinitialize(
        self,
        tcp_server_port: int,
        tcp_server_host: str,
    ) -> None:
        """
        Reinitialize the configuration of the state.

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
        Returns initialized CommunicationBackend.

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

    def add_socket(self, sid: str):
        """
        Adds connected socket.

        Parameters
        ----------
        sid : str
            Session ID of connected socket
        """
        self._connected_sockets.append(sid)

    def remove_socket(self, sid: str):
        """
        Removes disconnected socket.

        Parameters
        ----------
        sid : str
            Session ID of disconnected socket
        """
        if sid in self._connected_sockets:
            self._connected_sockets.remove(sid)

    @property
    def connected_frontends(self) -> int:
        """
        Number of connected frontends.
        """
        return len(self._connected_sockets)

    @property
    def last_socket(self) -> any:
        """
        Session ID of last connected socket.
        """
        if self._connected_sockets:
            return self._connected_sockets[-1]
        return None

    def get_schema(self) -> dict:
        """
        Returns dataflow specification schema.

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
