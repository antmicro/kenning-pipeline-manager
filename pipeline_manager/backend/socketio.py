from http import HTTPStatus
from typing import Dict, Tuple

from flask import Flask
from flask_socketio import SocketIO
from engineio.payload import Payload
from pipeline_manager_backend_communication.json_rpc_base import JSONRPCBase  # noqa: E501
from pipeline_manager_backend_communication.misc_structures import (
    Status,
)
from jsonrpc.jsonrpc2 import JSONRPC20Response
from jsonrpc.exceptions import JSONRPCDispatchException

from pipeline_manager.backend.flask import create_app
from pipeline_manager.backend.tcp_socket import start_socket_thread
from pipeline_manager.backend.state_manager import global_state_manager

Payload.max_decode_packets = 500


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
            Event used to start a two-way communication TCP server that
            listens on a host and port specified by `host` and `port`.

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
                # Socket reconnected, new thread
                # receiving messages has to be spawned
                start_socket_thread(socketio)
                return {}
            raise JSONRPCDispatchException(
                message='External application did not connect',
                code=HTTPStatus.SERVICE_UNAVAILABLE.value
            )

    json_rpc_backend = JSONRPCBase()
    json_rpc_backend.register_methods(BackendMethods(), 'backend')

    @socketio.on("backend-api")
    def backend_api(json_rpc_request: Dict):
        """
        Event managing backend's JSON-RPC methods.

        Parameters
        ----------
        json_rpc_request : Dict
            Request in JSON-RPC format
        """
        resp = json_rpc_backend.generate_json_rpc_response(
            json_rpc_request
        )
        socketio.emit('api-response', resp.data)
        return True

    @socketio.on("external-api")
    def api(json_rpc_message: Dict):
        """
        Event redirecting JSON-RPC messages to external application.

        Parameters
        ----------
        json_rpc_request : Dict
            Request in JSON-RPC format
        """
        tcp_server = global_state_manager.tcp_server
        is_request = 'method' in json_rpc_message
        if not tcp_server.connected:
            if is_request:
                socketio.emit('api-response', JSONRPC20Response(
                    _id=json_rpc_message['id'],
                    error={
                        'message': 'External application is disconnected',
                        'code': HTTPStatus.SERVICE_UNAVAILABLE.value,
                    }
                ).data)
            return False
        out = tcp_server.send_jsonrpc_message(json_rpc_message)
        if out.status != Status.DATA_SENT:
            if is_request:
                socketio.emit('api-response', JSONRPC20Response(
                        _id=json_rpc_message['id'],
                        error={
                            'message': 'Error while sending a message to the external application',  # noqa: E501
                            'code': HTTPStatus.SERVICE_UNAVAILABLE.value,
                        }
                    ).data
                )
            return False
        return True

    return socketio, app
