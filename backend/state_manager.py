import json
from importlib.resources import open_text

from server import PMServer
import resources


class PMStateManager:
    def __init__(
        self,
        tcp_port: str = '127.0.0.1',
        tcp_host: int = 9000,
    ) -> None:
        self.tcp_port = tcp_port
        self.tcp_host = tcp_host
        self.server = None

        self.schema = None
        self.schema_filename = 'dataflow_spec_schema.json'

    def initialize(
        self,
        tcp_port: str,
        tcp_host: int,
    ) -> None:
        self.tcp_port = tcp_port
        self.tcp_host = tcp_host

    def get_tcp_server(self) -> PMServer:
        if not self.server:
            self.server = PMServer(self.tcp_host, self.tcp_port)
        return self.server

    def get_schema(self) -> dict:
        if not self.schema:
            with open_text(
                resources,
                self.schema_filename
            ) as f:
                self.schema = json.load(f)
        return self.schema
