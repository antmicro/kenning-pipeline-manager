from http import HTTPStatus
from typing import Dict, Callable, Any

from engineio.payload import Payload
from pipeline_manager_backend_communication.json_rpc_base import JSONRPCBase  # noqa: E501
from pipeline_manager_backend_communication.misc_structures import (
    Status, CustomErrorCode,
)
from jsonrpc.jsonrpc2 import JSONRPC20Response, JSONRPC20Request
from jsonrpc.exceptions import JSONRPCDispatchException
import socketio

from pipeline_manager.backend.tcp_socket import (
    start_socket_task, join_listener_task
)
from pipeline_manager.backend.state_manager import global_state_manager

Payload.max_decode_packets = 500


def create_socketio() -> socketio.AsyncServer:
    """
    Creates python-socketio asynchronous server.

    Returns
    -------
    socketio.AsyncServer :
        Returns a socketio instance
    """

    sio = socketio.AsyncServer(async_mode='asgi')

    def reject_old_sessions_requests(
        func: Callable[[str, Dict], Any],
    ) -> Callable[[str, Dict], Any]:
        """
        Decorator checking if a received message is a request
        and came from the newest session.

        If not, error response is sent back, apart from two types of messages:
        * status_get - to maintain connection,
        * dataflow_stop - to enable stopping long runs.
        """
        async def _func(sid, json_rpc_request):
            if (
                sid != global_state_manager.last_socket
                and 'method' in json_rpc_request
                and json_rpc_request['method'] not in (
                    'status_get', 'dataflow_stop',
                )
            ):
                await sio.emit(
                    'api-response',
                    JSONRPC20Response(
                        _id=json_rpc_request['id'],
                        error={
                            'code': CustomErrorCode.NEWER_SESSION_AVAILABLE.value,  # noqa: E501
                            'message': 'The newer session is opened, this request was ignored',  # noqa: E501
                        }
                    ).data,
                    to=sid,
                )
                return True
            return await func(sid, json_rpc_request)
        return _func

    class BackendMethods:
        """
        Object containing all JSON-RPC methods for backend
        """

        def status_get(self) -> Dict:
            """
            Event that returns connection status.

            Returns
            -------
            Dict :
                Returned value depending on the status of the connection.
            """
            tcp_server = global_state_manager.tcp_server
            return {'status': {'connected': tcp_server.connected}}

        async def external_app_connect(self) -> Dict:
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

            async with global_state_manager.connecting_token:
                if tcp_server.connected:
                    return {}
                else:
                    await tcp_server.disconnect()
                    await join_listener_task()
                    await tcp_server.initialize_server()
                    out = await tcp_server.wait_for_client(
                        tcp_server.receive_message_timeout
                    )
                    while out.status != Status.CLIENT_CONNECTED and \
                            not global_state_manager.server_should_stop:
                        out = await tcp_server.wait_for_client(
                            tcp_server.receive_message_timeout
                        )
            if out.status == Status.CLIENT_CONNECTED:
                # Socket reconnected, new thread
                # receiving messages has to be spawned
                start_socket_task(sio)
                return {}
            if not global_state_manager.server_should_stop:
                raise JSONRPCDispatchException(
                    message='External application did not connect',
                    code=HTTPStatus.SERVICE_UNAVAILABLE.value
                )

        def connected_frontends_get(self):
            """
            Event that returns number of connections with SocketIO.

            Returns
            -------
            Dict
                Returned number of connections.
            """
            return {'connections': global_state_manager.connected_frontends}

    json_rpc_backend = JSONRPCBase()
    json_rpc_backend.register_methods(BackendMethods(), 'backend')

    @sio.on('connect')
    async def _connect(sid, environ, auth):
        """
        Special event used when socket connects.
        """
        print(sid, global_state_manager.connected_frontends)
        if global_state_manager.connected_frontends > 0:
            notification = JSONRPC20Request(
                    method='notification_send',
                    params={
                        'type': 'warning',
                        'title': 'Newer session connected',
                        'details': 'Further messages will be ignored',
                    },
                ).data
            del notification['id']
            await sio.emit(
                'api',
                notification,
                to=global_state_manager.last_socket,
            )
        global_state_manager.add_socket(sid)

    @sio.on('disconnect')
    async def _disconnect(sid):
        """
        Special event used when socket disconnects.
        """
        prev_socket = global_state_manager.last_socket
        global_state_manager.remove_socket(sid)
        if prev_socket == sid:
            notification = JSONRPC20Request(
                    method='notification_send',
                    params={
                        'type': 'warning',
                        'title': 'This session is the newest one',
                        'details': 'Messages will no longer be ignored',
                    },
                ).data
            del notification['id']
            await sio.emit(
                'api',
                notification,
                to=global_state_manager.last_socket,
            )

    @sio.on("backend-api")
    @reject_old_sessions_requests
    async def backend_api(sid, json_rpc_request: Dict):
        """
        Event managing backend's JSON-RPC methods.

        Parameters
        ----------
        json_rpc_request : Dict
            Request in JSON-RPC format
        """
        resp = await json_rpc_backend.generate_json_rpc_response(
            json_rpc_request
        )
        await sio.emit('api-response', resp.data, to=sid)
        return True

    @sio.on("external-api")
    @reject_old_sessions_requests
    async def api(sid, json_rpc_message: Dict):
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
                await sio.emit('api-response', JSONRPC20Response(
                    _id=json_rpc_message['id'],
                    error={
                        'message': 'External application is disconnected',
                        'code': HTTPStatus.SERVICE_UNAVAILABLE.value,
                    }
                ).data, to=sid)
            return False
        out = await tcp_server.send_jsonrpc_message_with_sid(
            json_rpc_message,
            sid,
        )
        if out.status != Status.DATA_SENT:
            if is_request:
                await sio.emit('api-response', JSONRPC20Response(
                        _id=json_rpc_message['id'],
                        error={
                            'message': 'Error while sending a message to the external application',  # noqa: E501
                            'code': HTTPStatus.SERVICE_UNAVAILABLE.value,
                        }
                    ).data,
                    to=sid,
                )
            return False
        return True

    return sio
