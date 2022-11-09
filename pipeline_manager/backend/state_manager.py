import json
from importlib.resources import open_text

from pipeline_manager.backend.server import PMServer
from pipeline_manager.resources import schemas


class PMStateManager:
    """
    Global state manager that should be used work with the application state.

    This class should not be imported directly, but rather
    `global_state_manager` object should be imported to use this class.
    """
    def __init__(
            self,
            tcp_server_port: str = '127.0.0.1',
            tcp_server_host: int = 9000,
            ) -> None:
        """
        Creates a state manager

        Parameters
        ----------
        tcp_server_port : str
            Application port that is going to be used for the
            TCP server socket.
        tcp_server_host : int
            IPv4 of the server that is going to be used for the
            TCP server socket.
        """
        self.tcp_server_port = tcp_server_port
        self.tcp_server_host = tcp_server_host
        self.server = None

        self.schema = None
        self.schema_filename = 'dataflow_spec_schema.json'

    def initialize(
            self,
            tcp_server_port: str,
            tcp_server_host: int,
            ) -> None:
        """
        Reinitialize the configuration of the state

        Parameters
        ----------
        tcp_server_port : str
            Application port that is going to be used for the
            TCP server socket.
        tcp_server_host : int
            IPv4 of the server that is going to be used for the
            TCP server socket.
        """
        self.tcp_server_port = tcp_server_port
        self.tcp_server_host = tcp_server_host

    def get_tcp_server(self) -> PMServer:
        """
        Returns initialized PMServer

        Returns
        -------
        PMServer
            Initialied PMServer
        """
        if not self.server:
            self.server = PMServer(self.tcp_server_host, self.tcp_server_port)
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
            with open_text(
                schemas,
                self.schema_filename
            ) as f:
                self.schema = json.load(f)
        return self.schema


# Singleton-like object that should be imported
global_state_manager = PMStateManager()
