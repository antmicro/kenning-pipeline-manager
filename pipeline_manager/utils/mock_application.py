import json
import time

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
            port: int,
            sample_specification: dict,
            sample_dataflow: dict) -> None:
        """
        Parameters
        ----------
        host : str
            IPv4 of the TCP server socket to connect to.
        port : int
            Application port of the TCP server socket
        sample_specification : dict
            Sample specification that is used to handle
            SPECIFICATION messages type.
        sample_dataflow : dict
            Sample dataflow that is used to handle
            IMPORT messages type.
        """
        self.host = host
        self.port = port
        self.sample_specification = sample_specification
        self.sample_dataflow = sample_dataflow

        self.connecting_time_offset = 0.1
        self.client = CommunicationBackend(host, port)

    def try_connecting(self) -> None:
        """
        Function that tries to connect to TCP server.

        If it fails to connect because the TCP server socker is closed
        it retries to connect every `self.connecting_time_offset` seconds
        until success.
        """
        while True:
            try:
                out = self.client.initialize_client()
                if out.status == Status.CLIENT_CONNECTED:
                    return
            except ConnectionRefusedError:
                time.sleep(self.connecting_time_offset)

    def answer_valid(self) -> None:
        """
        Waits for an incoming message, reads it and based on the
        `MessageType` sends an appropriate message.

        It is used to simulate a regular application that waits for requests.
        """
        status, message = self.client.wait_for_message()
        if status == Status.DATA_READY:
            message_type, data = message
            if message_type == MessageType.VALIDATE:
                self.client.send_message(
                    MessageType.OK,
                    'Validation was successful'.encode(encoding='UTF-8')
                )
            elif message_type == MessageType.SPECIFICATION:
                self.client.send_message(
                    MessageType.OK,
                    json.dumps(
                        self.sample_specification
                    ).encode(encoding='UTF-8')
                )
            elif message_type == MessageType.RUN:
                self.client.send_message(
                    MessageType.OK,
                    'Run was successful'.encode(encoding='UTF-8')
                )
            elif message_type == MessageType.IMPORT:
                self.client.send_message(
                    MessageType.OK,
                    json.dumps(
                        self.sample_dataflow
                    ).encode(encoding='UTF-8')
                )
            elif message_type == MessageType.EXPORT:
                self.client.send_message(
                    MessageType.OK,
                    'Export was successful'.encode(encoding='UTF-8')
                )

    def answer_empty(self) -> None:
        """
        Waits for an incoming message, reads it and answers with
        an empty message of type `MessageType.OK`.
        """
        status, message = self.client.wait_for_message()
        if status == Status.DATA_READY:
            message_type, data = message
            self.client.send_message(
                MessageType.OK,
                bytes()
            )

    def disconnect(self) -> None:
        """
        Disconnects the application from the TCP server.
        """
        self.client.disconnect()
