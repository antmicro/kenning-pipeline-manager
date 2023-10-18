import json
from http import HTTPStatus
from typing import Any, Dict, Tuple

from flask import Flask
from flask_socketio import SocketIO
from pipeline_manager_backend_communication.misc_structures import (
    MessageType,
    OutputTuple,
    Status,
)

from pipeline_manager.backend.app import create_app
from pipeline_manager.backend.state_manager import global_state_manager


def create_socketio() -> Tuple[SocketIO, Flask]:
    """
    Wraps the flask instance with socketio events used to communicate
    with frontend application

    Returns
    -------
    Tuple[SocketIO, Flask] :
        Returns a socketio instance and flask instance that was used
    """
    app = create_app()

    socketio = SocketIO(app)

    def response_wrapper(
        output_message: OutputTuple,
    ) -> Tuple[Any, HTTPStatus]:
        """
        Helper function used to create HTTP responses based on the flow
        of the communication with the external application.

        Parameters
        ----------
        output_message : OutputTuple
            Output of `wait_for_message()` function. It is used to used
            to create a response based on the content and status of
            the output.

        Returns
        -------
        Tuple[Any, HTTPStatus] :
            Tuple where the first element depends on the second element
            The second element is the status code. It can be either:

                - HTTPStatus.OK if the request was successful. Then the first
                element contains a dictionary with keys `type` and `content`
                that convey the original Pipeline Manager message.
                - HTTPStatus.SERVICE_UNAVAILABLE if external application was
                disconnected or an error was raised during the request
                handling. The first element contains the error message.
        """
        if output_message.status == Status.DATA_READY:
            mess_type, content = output_message.data

            try:
                content = json.loads(content)
            except json.JSONDecodeError:
                content = content.decode("UTF-8")

            return {
                "type": mess_type.value,
                "content": content,
            }, HTTPStatus.OK
        if output_message.status == Status.CONNECTION_CLOSED:
            return (
                "External application is disconnected",
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
        return "Unknown error", HTTPStatus.SERVICE_UNAVAILABLE

    def wrap_output(f):
        """
        Decorator that wraps returned tumple of the f function
        into a dictonary with to attributes.
        """

        def wrapper(*args, **kwargs):
            result = f(*args, **kwargs)
            return {
                "data": result[0],
                "status": result[1],
            }

        return wrapper

    @socketio.on("get_status")
    @wrap_output
    def get_status() -> bool:
        """
        Event that returns connection status.

        Returns
        -------
        Tuple[Any, HTTPStatus] :
            Returned value depending on the status of the connection.
        """
        tcp_server = global_state_manager.tcp_server
        if tcp_server.connected:
            return 'External application connected', HTTPStatus.OK
        else:
            return 'External application disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501

    @socketio.on("external_app_connect")
    @wrap_output
    def external_app_connect() -> Dict[str, Any]:
        """
        Event used to start a two-way communication TCP server that listens on
        a host and port specified by `host` and `port`.

        It returns once an external application is connected to it.

        If a connection already exists and a new request is made to this
        endpoint this function does not return an error.

        Responses
        ---------
        Tuple[Any, HTTPStatus] :
            Returned value depending on the status of the connection.
        """
        tcp_server = global_state_manager.tcp_server

        if tcp_server.connected:
            return "External application already connected", HTTPStatus.OK
        else:
            tcp_server.disconnect()
            tcp_server.initialize_server()
            out = tcp_server.wait_for_client()
        if out.status == Status.CLIENT_CONNECTED:
            return "External application connected", HTTPStatus.OK
        return (
            "External application did not connect",
            HTTPStatus.SERVICE_UNAVAILABLE,
        )

    @socketio.on("request_specification")
    @wrap_output
    def request_specification() -> Tuple[Any, HTTPStatus]:
        """
        Event used to request a dataflow specification
        from the external application.

        A communication has to be established first with a `connect`
        event first.

        Returns
        ---------
        Tuple[Any, HTTPStatus] :
            If the request was successful the first element contains
            a dictionary with keys `type` and `content` that convey
            the original Pipeline Manager message. Otherwise the first
            element contains an error message.
        """
        tcp_server = global_state_manager.tcp_server

        if not tcp_server.connected:
            return (
                "External application is disconnected",
                HTTPStatus.SERVICE_UNAVAILABLE,
            )

        out = tcp_server.send_message(MessageType.SPECIFICATION)
        if out.status != Status.DATA_SENT:
            return (
                "Error while sending a message to the external application",
                HTTPStatus.SERVICE_UNAVAILABLE,
            )

        out = tcp_server.wait_for_message()
        return response_wrapper(out)

    @socketio.on("receive_message")
    @wrap_output
    def receive_message() -> Tuple[Any, HTTPStatus]:
        """
        General purpose event that returns a single message
        from the application created by `response_wrapper`.
        """
        tcp_server = global_state_manager.tcp_server
        out = tcp_server.wait_for_message()
        return response_wrapper(out)

    @socketio.on("dataflow_action_request")
    @wrap_output
    def dataflow_action_request(
        request_type: str, dataflow: str
    ) -> Tuple[Any, HTTPStatus]:
        """
        Event that is used to request a certain action on
        a dataflow that is sent as a prameter dataflow.

        Parameters
        ----------
        request_type : str
            Type of the action that is performed on the attached dataflow.
            For now supported actions are `run`, `validate`, `export`
            and `import`
        dataflow : str
            Dataflow that is being processed

        Returns
        ---------
        Tuple[Any, HTTPStatus] :
            If the request was successful the first element contains a
            dictionary with keys `type` and `content` that convey
            the original Pipeline Manager message.
            Otherwise the first element contains an error message.
        """
        tcp_server = global_state_manager.tcp_server

        if not tcp_server.connected:
            return (
                "External application is disconnected",
                HTTPStatus.SERVICE_UNAVAILABLE,
            )

        request_type_to_message_type = {
            "validate": MessageType.VALIDATE,
            "run": MessageType.RUN,
            "export": MessageType.EXPORT,
            "import": MessageType.IMPORT,
        }

        try:
            message_type = request_type_to_message_type[request_type]
            out = tcp_server.send_message(
                message_type, dataflow.encode(encoding="UTF-8")
            )
        except KeyError:
            return "No request type specified", HTTPStatus.SERVICE_UNAVAILABLE

        if out.status != Status.DATA_SENT:
            return (
                "Error while sending a message to the external application",
                HTTPStatus.SERVICE_UNAVAILABLE,
            )

        out = tcp_server.wait_for_message()
        return response_wrapper(out)

    return socketio, app
