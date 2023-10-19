import json
from http import HTTPStatus
from typing import Dict, Tuple

from flask import Flask
from flask_socketio import SocketIO
from pipeline_manager_backend_communication.json_rpc_base import JSONRPCBase  # noqa: E501
from pipeline_manager_backend_communication.misc_structures import (
    OutputTuple,
    Status,
)
from jsonrpc.jsonrpc2 import JSONRPC20Response
from jsonrpc.exceptions import JSONRPCDispatchException

from pipeline_manager.backend.app import create_app
from pipeline_manager.backend.state_manager import global_state_manager


class BackendMethods:
    """
    Object containing all JSON-RPC methods for backend
    """

    def get_status(self) -> Dict:
        """
        Event that returns connection status.

        Returns
        -------
        Dict :
            Returned value depending on the status of the connection.
        """
        tcp_server = global_state_manager.tcp_server
        return {'status': {'connected': tcp_server.connected}}

    def external_app_connect(self) -> Dict:
        """
        Event used to start a two-way communication TCP server that listens on
        a host and port specified by `host` and `port`.

        It returns once an external application is connected to it.

        If a connection already exists and a new request is made to this
        endpoint this function does not return an error.

        Responses
        ---------
        Dict :
            Returned value depending on the status of the connection.

        Raises
        ------
        JSONRPCDispatchException :
            Exception raised when service is unavailable
        """
        tcp_server = global_state_manager.tcp_server

        if tcp_server.connected:
            return {}
        else:
            tcp_server.disconnect()
            tcp_server.initialize_server()
            out = tcp_server.wait_for_client()
        if out.status == Status.CLIENT_CONNECTED:
            return {}
        raise JSONRPCDispatchException(
            message='External application did not connect',
            code=HTTPStatus.SERVICE_UNAVAILABLE.value
        )


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

    communication_backend = JSONRPCBase()
    communication_backend.register_methods(BackendMethods(), 'backend')

    def json_rpc_response_wrapper(
        content: OutputTuple, status: HTTPStatus, _id: int,
    ) -> Dict:
        """
        Converts OutputTuple and HTTPStatus into valid JSON-RPC format.

        Parameters
        ----------
        content : OutputTuple
            MessageType and content received from external app
        status : HTTPStatus
            Status of received message
        _id : int
            ID of JSON-RPC request
        """
        if isinstance(content, Exception):
            return JSONRPC20Response(
                _id=_id,
                error={
                    'message': str(content),
                    'code': status.value,
                }
            ).data
        if content is None:
            return JSONRPC20Response(
                _id=_id,
                error={
                    'message': 'Empty message received',
                    'code': status.value,
                }
            ).data
        return json.loads(content[1])

    @socketio.on("backend-api")
    def backend_api(json_rpc_request: Dict) -> Dict:
        """
        Event managing backend's JSON-RPC methods.

        Parameters
        ----------
        json_rpc_request : Dict
            Request in JSON-RPC format

        Returns
        -------
        Dict :
            Response in JSON-RPC format
        """
        resp = communication_backend.generate_json_rpc_response(
            json_rpc_request
        )
        return resp.data

    @socketio.on("api")
    def api(json_rpc_request: Dict) -> Dict:
        """
        Event redirecting JSON-RPC requests to external application.

        Parameters
        ----------
        json_rpc_request : Dict
            Request in JSON-RPC format

        Returns
        -------
        Dict :
            Response in JSON-RPC format
        """
        tcp_server = global_state_manager.tcp_server
        if not tcp_server.connected:
            return JSONRPC20Response(
                _id=json_rpc_request['id'],
                error={
                    'message': 'External application is disconnected',
                    'code': HTTPStatus.SERVICE_UNAVAILABLE.value,
                }
            ).data
        out = tcp_server.send_jsonrpc_message(json_rpc_request)
        if out.status != Status.DATA_SENT:
            return JSONRPC20Response(
                _id=json_rpc_request['id'],
                error={
                    'message': 'Error while sending a message to the external application',  # noqa: E501
                    'code': HTTPStatus.SERVICE_UNAVAILABLE.value,
                }
            ).data
        response = tcp_server.wait_for_message()
        return json_rpc_response_wrapper(
            response.data,
            response.status,
            int(json_rpc_request['id'])
        )

    return socketio, app
