import socket
import select
import logging
from enum import Enum
from typing import NamedTuple, Union

log = logging.getLogger()
logging.basicConfig(level=logging.NOTSET)


class MessageType(Enum):
    """
    Enum that is used do specify a message type.

    OK - type indicating success. Should only be used by the client.
    ERROR - type indicating error. Should only be used by the client.

    VALIDATE - type indicating that the message is a validation request.
        Should only be used by the server.
    SPECIFICATION - type indicating that the message is a specification
        request. Should only be used by the server.
    """
    OK = 0
    ERROR = 1
    VALIDATE = 2
    SPECIFICATION = 3

    def to_bytes(self) -> bytes():
        """
        Converts MessageType Enum to bytes.

        Returns
        -------
        bytes :
            Converted Enum
        """
        return int(self.value).to_bytes(length=2, byteorder='big', signed=False)  # noqa: E501

    @staticmethod
    def from_bytes(b: bytes) -> 'MessageType':
        """
        Converts two bytes to a MesssageType Enum

        Parameters
        ----------
        b : bytes
            Bytes that represent a MessageType Enum.

        Returns
        -------
        MessageType :
            Enum that is represented by `b` parameter.

        """
        return MessageType(int.from_bytes(b, byteorder='big', signed=False))


class Status(Enum):
    """
    Enum that is used to represent server status after a function was called.

    NOTHING - general use type used when there is no particular server status.
    SERVER_INITIALIZED - type indicating that the server was initialized
        successfully.
    CLIENT_CONNECTED - type indicating that a client was connected
        successfully.
    CLIENT_DISCONNECTED - type indicating that a client disconnected.
    CLIENT_IGNORE - type indicating that there was a new connection request
        which was ignored, because there is already a client connected.
    DATA_READY - type indicating that a message was fully received and can
        be read.
    DATA_SENT - type indicating that a message was successfully sent.
    ERROR - type indicating that function that was called raised an error.
    SERVER_DISCONNECTED - type indicating that the server was disconnected,
        along with a client if there was one.
    """
    NOTHING = 0
    SERVER_INITIALIZED = 1
    CLIENT_CONNECTED = 2
    CLIENT_DISCONNECTED = 3
    CLIENT_IGNORED = 4
    DATA_READY = 5
    DATA_SENT = 6
    ERROR = 7
    SERVER_DISCONNECTED = 8


class OutputTuple(NamedTuple):
    status: Status
    data: Union[tuple[MessageType, bytes], Exception, None]
    """
    Simple structure that should be used to return information when
    invoking a function from PMServer.

    Parameters
    ----------
    status : Status
        Status of the server when returning from a function.
    data : Union[tuple(MessageType, bytes), Exception, None]
        Any additional information that should be passed,
        along with the status.
    """


class PMServer(object):
    """
    TCP server that communicates with a single client.

    Every message is of a format:

    SIZE : 4 bytes | TYPE : 2 bytes | CONTENT : SIZE bytes

    Where:
    - SIZE    - four first bytes are unsigned int and state the size of the
                content of the message in bytes.
    - TYPE    - two next bytes are unsinged int and state the type of
                the message.
    - CONTENT - the rest of the bytes convey the data.

    Every function that can be invoked should return a tuple (Status, Any).
    The first element states a status of the server after executing the
    function.
    The second element can be any additional information.
    """
    def __init__(self, host: str, port: int) -> None:
        """
        Creates the server.

        Parameters
        ----------
        host : str
            IPv4 of the server that is going to be used for the
            TCP server socket.
        port : str
            Application port that is going to be used for the
            TCP server socket.
        """
        self.host = host
        self.port = port

        self.packet_size = 4096
        self.server_socket = None
        self.client_socket = None
        self.collected_data = bytes()

    def initialize_server(self) -> OutputTuple:
        """
        Initializes the server socket.

        Returns
        -------
        OutputTuple :
            Where Status states whether the initialization was successful.
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
        return OutputTuple(Status.SERVER_INITIALIZED, None)

    def wait_for_client(
            self,
            timeout: float = 0
            ) -> OutputTuple:
        """
        Listens on the server socket for a client to connect.

        Parameters
        ----------
        timeout : float
            Time that the server socket is going to wait for
            a client to connect. If it is zero then the server socket
            blocks indefinitely.

        Returns
        -------
        OutputTuple :
            Where Status states whether a client was connected.
        """
        log.info(f'Server is listening on {self.host}:{self.port}')
        ready, _, _ = select.select([self.server_socket], [], [], timeout)
        if ready:
            code = self.accept_client()
            return code
        return OutputTuple(Status.NOTHING, None)

    def accept_client(self) -> OutputTuple:
        """
        Accepts a client that has connected to the server socket.

        Returns
        -------
        OutputTuple :
            Where Status states whether the initialization was successful.
        """
        socket, addr = self.server_socket.accept()
        if self.client_socket is not None:
            log.info('Different client already connected')
            socket.close()
            return OutputTuple(Status.CLIENT_IGNORED, None)
        else:
            log.info('Client connected')
            self.client_socket = socket
            self.client_socket.setblocking(False)
        return OutputTuple(Status.CLIENT_CONNECTED, None)

    def wait_for_response(
            self,
            timeout: float = 0
            ) -> OutputTuple:
        """
        Waits for a message from the client socket.

        Parameters
        ----------
        timeout : float
            Time that the server is going to wait for a client's message.
            If it is zero then the server socket blocks indefinitely.

        Returns
        -------
        OutputTuple :
            Where Status states whether there is data to be read and the
            data argument is either a None or a message received from the
            client.
        """
        ready, _, _ = select.select([self.client_socket], [], [], timeout)
        if ready:
            return self.receive_data()

        return OutputTuple(Status.NOTHING, None)

    def receive_data(
            self
            ) -> OutputTuple:
        """
        Tries to read data from the client.

        Returns
        -------
        OutputTuple :
            Where Status states whether there is data to be read and the
            data argument is either a None or a message received from the
            client.
        """
        data = self.client_socket.recv(self.packet_size)
        if not data:
            log.info('Client disconnected from the server')
            self.client_socket.close()
            self.client_socket = None
            return OutputTuple(Status.CLIENT_DISCONNECTED, None)
        return self.parse_received(data)

    def parse_received(
            self,
            data: bytes
            ) -> OutputTuple:
        """
        Collects received bytes and checks whether collected a full message.
        All bytes that are received from the client socket using `recv` should
        be passed to this function.

        Messages are of format:

        SIZE : 4 bytes | TYPE : 2 bytes | CONTENT : SIZE bytes

        Parameters
        ----------
        data : bytes
            Bytes that are received from the client socket sequentially.

        Returns
        -------
        OutputTuple :
            Where Status states whether there is data to be read and the
            data argument is either a None or a message received from the
            client.
        """
        self.collected_data += data

        # Checking whether a header of the message was received
        if len(self.collected_data) < 6:
            return OutputTuple(Status.NOTHING, None)

        content_size = int.from_bytes(
            self.collected_data[:4],
            byteorder='big',
            signed=False
        )

        # Checking whether a full message was received.
        if len(self.collected_data) - 4 < content_size:
            return OutputTuple(Status.NOTHING, None)

        # Collecting the message and removing the bytes from the buffer.
        message = self.collected_data[4:4 + content_size]
        self.collected_data = self.collected_data[4 + content_size:]

        message_type = MessageType.from_bytes(message[:2])
        message_content = message[2:]

        return OutputTuple(Status.DATA_READY, (message_type, message_content))

    def send_request(
            self,
            mtype: MessageType,
            data: bytes = bytes()
            ) -> OutputTuple:
        """
        Sends a request of a specified type and content.

        ----------
        mtype : MessageType
            Type of the request.
        data : bytes, optional
            Content of the request.

        Returns
        -------
        OutputTuple :
            Where Status states whether sending the request was successful and
            the data argument is either a None or an exception that was
            raised while sending the message.
        """
        return self._send_message(mtype.to_bytes() + data)

    def _send_message(
            self,
            data: bytes
            ) -> OutputTuple:
        """
        An internal function that adds a length block to the request and sends
        it to the client socket.

        Parameters
        ----------
        data : bytes
            Content of the request.

        Returns
        -------
        OutputTuple :
            Where Status states whether sending the request was successful and
            the data argument is either a None or an exception that was
            raised while sending the message.
        """
        length = (len(data)).to_bytes(4, byteorder='big', signed=False)
        message = length + data
        try:
            self.client_socket.sendall(message)
            return OutputTuple(Status.DATA_SENT, None)
        except Exception as ex:
            log.exception('Something went wrong when sending a message. Disconnecting')  # noqa: E501
            self.disconnect()
            return OutputTuple(Status.ERROR, ex)

    def disconnect(self) -> OutputTuple:
        """
        Disconnects both server socket and client socket.

        Returns
        -------
        OutputTuple :
            Where Status states whether disconnecting was successful.
        """
        if self.server_socket:
            self.server_socket.close()
            self.server_socket = None
        if self.client_socket:
            self.client_socket.close()
            self.client_socket = None

        return OutputTuple(Status.SERVER_DISCONNECTED, None)
