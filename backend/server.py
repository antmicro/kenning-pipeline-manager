import socket
import select
import logging
from enum import Enum
from typing import Optional

log = logging.getLogger()
logging.basicConfig(level=logging.NOTSET)


class MessageType(Enum):
    OK = 0
    ERROR = 1
    VALIDATE = 2
    SPECIFICATION = 3

    def to_bytes(self) -> bytes():
        return int(self.value).to_bytes(length=2, byteorder='big', signed=False)  # noqa: E501

    @staticmethod
    def from_bytes(b: bytes) -> 'MessageType':
        return MessageType(int.from_bytes(b, byteorder='big', signed=False))


class Status(Enum):
    NOTHING = 0
    SERVER_INITIALIZED = 1
    CLIENT_CONNECTED = 2
    CLIENT_DISCONNECTED = 3
    CLIENT_IGNORED = 4
    DATA_READY = 5
    DATA_SEND = 6
    ERROR = 7
    SERVER_DISCONNECTED = 8


class PMServer(object):
    def __init__(self, host: str, port: int) -> None:
        self.host = host
        self.port = port

        self.packet_size = 4096
        self.server_socket = None
        self.client_socket = None
        self.collected_data = bytes()

    def initialize_server(self) -> tuple[Status, None]:
        """
        Initializes the server socket
        """
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(
            socket.SOL_SOCKET,
            socket.SO_REUSEADDR,
            1
        )
        self.server_socket.bind((self.host, self.port))
        self.server_socket.setblocking(False)
        self.server_socket.listen(1)
        return Status.SERVER_INITIALIZED, None

    def wait_for_client(
            self,
            timeout: float = 0
            ) -> tuple[Status, None]:
        """
        Listens on server socket for a client to connect

        Parameters
        ----------
        timeout : float
            Time that the server socket is going to wait for
            a client to connect. If it is zero then the server socket
            blocks indefinitely
        """
        log.info(f'Server is listening on {self.host}:{self.port}')
        ready, _, _ = select.select([self.server_socket], [], [], timeout)
        if ready:
            code = self.accept_client()
            return code
        return Status.NOTHING, None

    def accept_client(self) -> tuple[Status, None]:
        """
        Accepts a client that has connected to the server socket
        """
        socket, addr = self.server_socket.accept()
        if self.client_socket is not None:
            log.info('Different client already connected')
            socket.close()
            return Status.CLIENT_IGNORED, None
        else:
            log.info('Client connected')
            self.client_socket = socket
            self.client_socket.setblocking(False)
        return Status.CLIENT_CONNECTED, None

    def wait_for_response(
            self,
            timeout: float = 0
            ) -> tuple[Status, Optional[tuple[MessageType, Optional[bytes]]]]:
        """
        Waits for a message from the client socket

        Parameters
        ----------
        timeout : float
            Time that the server is going to wait for a client's message.
            If it is zero then the server socket blocks indefinitely
        """
        ready, _, _ = select.select([self.client_socket], [], [], timeout)
        if ready:
            return self.receive_data()

        return Status.NOTHING, None

    def receive_data(
            self
            ) -> tuple[Status, Optional[tuple[MessageType, Optional[bytes]]]]:
        data = self.client_socket.recv(self.packet_size)
        if not data:
            log.info('Client disconnected from the server')
            self.client_socket.close()
            self.client_socket = None
            return Status.CLIENT_DISCONNECTED, None
        return self.parse_received(data)

    def parse_received(
            self,
            data: bytes
            ) -> tuple[Status, Optional[tuple[MessageType, Optional[bytes]]]]:
        """
        Collects received bytes and checks whether collected a full message.
        All bytes that are received from the client socket using `recv` should
        be passed to this function

        Messages are of format:

        SIZE : 4 bytes | TYPE : 2 bytes | CONTENT : SIZE bytes

        Parameters
        ----------
        data : bytes
            Bytes that are received from the client socket sequentially.
        """
        self.collected_data += data

        if len(self.collected_data) < 6:
            return Status.NOTHING, None

        content_size = int.from_bytes(
            self.collected_data[:4],
            byteorder='big',
            signed=False
        )

        if len(self.collected_data) - 4 < content_size:
            return Status.NOTHING, None

        message = self.collected_data[4:4 + content_size]
        self.collected_data = self.collected_data[4 + content_size:]

        return Status.DATA_READY, self.parse_message(message)

    def parse_message(
            self,
            message: bytes
            ) -> tuple[MessageType, Optional[bytes]]:
        message_type = MessageType.from_bytes(message[:2])
        data = message[2:]
        return (message_type, data)

    def send_request(
            self,
            mtype: MessageType,
            data: bytes = bytes()
            ) -> tuple[Status, Optional[Exception]]:
        return self._send_message(mtype.to_bytes() + data)

    def _send_message(
            self,
            data: bytes
            ) -> tuple[Status, Optional[Exception]]:
        length = (len(data)).to_bytes(4, byteorder='big', signed=False)
        message = length + data
        try:
            self.client_socket.sendall(message)
            return Status.DATA_SEND, None
        except Exception as ex:
            log.info('Something went wrong when sending a message. Disconnecting')  # noqa: E501
            self.disconnect()
            return Status.ERROR, ex

    def disconnect(self) -> tuple[Status, None]:
        if self.server_socket:
            self.server_socket.close()
            self.server_socket = None
        if self.client_socket:
            self.client_socket.close()
            self.client_socket = None

        return Status.SERVER_DISCONNECTED, None
