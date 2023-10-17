# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Tuple, Any
from http import HTTPStatus

from flask import Flask, render_template, request
from flask_cors import CORS
from flask_socketio import SocketIO
from pipeline_manager_backend_communication.misc_structures import MessageType, Status, OutputTuple  # noqa: E501

from pipeline_manager import frontend
from pipeline_manager.backend.state_manager import global_state_manager
from pipeline_manager.utils.logger import string_to_verbosity

dist_path = os.path.join(os.path.dirname(frontend.__file__), 'dist')

app = Flask(
    'Pipeline Manager',
    static_url_path='',
    static_folder=dist_path,
    template_folder=dist_path
)

CORS(app)
socketio = SocketIO(app)

class GetStatusFilter(logging.Filter):
    def filter(self, record):
        return '/get_status' not in record.getMessage()


logging.getLogger("werkzeug").addFilter(GetStatusFilter())

@app.route('/', methods=['GET'])
def index():
    """
    Default GET enpoint that returns a simple frontend html file which
    works as a single page application.

    Responses
    ---------
    HTTPStatus.OK :
        Request was successful and the response contains
        entry HTML for the frontend application
    """
    return render_template('/index.html')


@app.route('/get_status', methods=['GET'])
def get_status():
    """
    GET endpoint that returns connection status.

    Responses
    ---------
    HTTPStatus.OK :
        External application is connected.
    HTTPStatus.SERVICE_UNAVAILABLE :
        External application is disconnected.
    """
    tcp_server = global_state_manager.get_tcp_server()

    if tcp_server.connected:
        return 'External application connected', HTTPStatus.OK
    else:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501


def response_wrapper(output_message: OutputTuple) -> Tuple[Any, HTTPStatus]:
    """
    Helper function used to create HTTP responses based on the flow
    of the communication with the external application.

    Parameters
    ----------
    output_message : OutputTuple
        Output of `wait_for_message()` function. It is used to used to create
        a HTTP response based on the content and status of the output.

    Returns
    -------
    Tuple :
        HTTP response being a tuple, where the first element is the body
        of the message, and the second is the HTTP code.
    """
    if output_message.status == Status.DATA_READY:
        mess_type, content = output_message.data

        try:
            content = json.loads(content)
        except json.JSONDecodeError:
            content = content.decode('UTF-8')

        return {'type': mess_type.value, 'content': content}, HTTPStatus.OK  # noqa: E501
    if output_message.status == Status.CONNECTION_CLOSED:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501
    return 'Unknown error', HTTPStatus.SERVICE_UNAVAILABLE


@app.route('/import_dataflow', methods=['POST'])
def import_dataflow():
    """
    POST endpoint that should be used to request importing a dataflow in
    external application format. This endpoint requests the connected external
    application to parse it into the Pipeline Manager format and send it
    to Pipeline Manager.

    The dataflow to be parsed should be put in the request body as a
    `external_application_dataflow` file.

    Responses
    ---------
    HTTPStatus.OK :
        Request was successful and the response contains a dictionary with
        keys `type` and `content` that convey the original Pipeline Manager
        message.
    HTTPStatus.SERVICE_UNAVAILABLE :
        External application was disconnected or an error was raised during
        the request handling. Response contains error message.
    """
    tcp_server = global_state_manager.get_tcp_server()

    if not tcp_server.connected:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501

    dataflow = request.files['external_application_dataflow'].read()
    out = tcp_server.send_message(MessageType.IMPORT, dataflow)

    if out.status != Status.DATA_SENT:
        return 'Error while sending a message to the external application', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501

    out = tcp_server.wait_for_message()
    return response_wrapper(out)


@app.route('/receive_message', methods=['GET'])
def receive_message():
    """
    General purpose endpoint that returns a single message from the application
    created by `response_wrapper`.
    """
    tcp_server = global_state_manager.get_tcp_server()
    out = tcp_server.wait_for_message()
    return response_wrapper(out)


@app.route('/connect', methods=['GET'])
def connect():
    """
    Endpoint used to start two-way communication TCP server that listens on
    a host and port specified by `host` and `port`.

    It returns once an external application is connected to it.

    If a connection already exists and a new request is made to this endpoint
    this function does not process anything.

    Responses
    ---------
    HTTPStatus.OK :
        Request was successful and an external application is connected.
    HTTPStatus.SERVICE_UNAVAILABLE :
        External application did not connect.
    """
    tcp_server = global_state_manager.get_tcp_server()

    if tcp_server.connected:
        return 'External application already connected', HTTPStatus.OK
    else:
        tcp_server.disconnect()
        tcp_server.initialize_server()
        out = tcp_server.wait_for_client()

    if out.status == Status.CLIENT_CONNECTED:
        return 'External application connected', HTTPStatus.OK
    return 'External application did not connect', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501


@app.route('/request_specification', methods=['GET'])
def request_specification():
    """
    GET endpoint that should is used to request a dataflow specification
    from an external application.

    A communication has to be established first with a `connect`
    endpoint first.

    Responses
    ---------
    HTTPStatus.OK :
        Request was successful and the response contains a dictionary with
        keys `type` and `content` that convey the original Pipeline Manager
        message.
    HTTPStatus.SERVICE_UNAVAILABLE :
        External application was disconnected or an error was raised during
        the request handling. Response contains error message.
    """
    tcp_server = global_state_manager.get_tcp_server()

    if not tcp_server.connected:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501

    out = tcp_server.send_message(MessageType.SPECIFICATION)

    if out.status != Status.DATA_SENT:
        return 'Error while sending a message to the external application', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501

    out = tcp_server.wait_for_message()
    return response_wrapper(out)


@app.route('/dataflow_action_request/<request_type>', methods=['POST'])
def dataflow_action_request(request_type: str):
    """
    POST endpoint that is used to request a certain action on
    a dataflow that is sent in a form under name `dataflow`.

    Parameters
    ----------
    request_type : str
        Type of the action that is performed on the attached dataflow.
        For now supported actions are `run`, `validate` and `export`

    Responses
    ---------
    HTTPStatus.OK :
        Request was successful and the response contains a dictionary with
        keys `type` and `content` that convey the original Pipeline Manager
        message.
    HTTPStatus.SERVICE_UNAVAILABLE :
        External application was disconnected or an error was raised during
        the request handling. Response contains error message.
    """
    tcp_server = global_state_manager.get_tcp_server()

    if not tcp_server.connected:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501
    dataflow = request.form.get('dataflow')

    request_type_to_message_type = {
        'validate': MessageType.VALIDATE,
        'run': MessageType.RUN,
        'export': MessageType.EXPORT
    }

    try:
        message_type = request_type_to_message_type[request_type]
        out = tcp_server.send_message(
            message_type,
            dataflow.encode(encoding='UTF-8')
        )
    except KeyError:
        return 'No request type specified', HTTPStatus.SERVICE_UNAVAILABLE

    if out.status != Status.DATA_SENT:
        return 'Error while sending a message to the external application', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501

    out = tcp_server.wait_for_message()
    return response_wrapper(out)


@app.errorhandler(404)
def default_handler(e):
    """
    Handler that returns the same thing as the default GET endpoint.

    Because it is a single page application the routing is managed by the
    frontend side. Every requests to the backend returns the same html page and
    only then the route is handled by the browser.

    Responses
    ---------
    HTTPStatus.OK :
        The response contains entry HTML for the frontend application
    """
    return render_template('/index.html')


def main(argv):
    parser = argparse.ArgumentParser(argv[0])
    parser.add_argument(
        '--tcp-server-host',
        type=str,
        help='The address of the Pipeline Manager TCP Server',
        default='127.0.0.1'
    )
    parser.add_argument(
        '--tcp-server-port',
        type=int,
        help='The port of the Pipeline Manager TCP Server',
        default=9000
    )
    parser.add_argument(
        '--backend-host',
        type=str,
        help='The adress of the backend of Pipeline Manager',
        default='127.0.0.1'
    )
    parser.add_argument(
        '--backend-port',
        type=int,
        help='The port of the backend of Pipeline Manager',
        default=5000
    )
    parser.add_argument(
        '--frontend-directory',
        help='Location of the built frontend. '
             'Used only when custom --output-directory was specified during '
             'building',
        type=Path
    )
    parser.add_argument(
        '--skip-connecting',
        action='store_true',
        help='Specifies whether Pipeline Manager should wait '
        'for an external application to connect before running the backend',
    )
    parser.add_argument(
        '--verbosity',
        help='Verbosity level',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        default='INFO',
        type=str
    )
    args, _ = parser.parse_known_args(argv[1:])
    logging.basicConfig(level=string_to_verbosity(args.verbosity))

    if not os.path.exists(dist_path) and not args.frontend_directory:
        logging.log(
            logging.ERROR,
            'Frontend files have not been found in the default directory.'
        )
        logging.log(
            logging.ERROR,
            'Build the frontend first or specify a custom path to the '
            'built frontend using --frontend-directory'
        )
        return

    if args.frontend_directory:
        app.static_folder = Path(os.getcwd()) / args.frontend_directory
        app.template_folder = Path(os.getcwd()) / args.frontend_directory

    global_state_manager.reinitialize(
        args.tcp_server_port,
        args.tcp_server_host
    )
    if not args.skip_connecting:
        logging.info(f'Waiting for connection from third-party application on {args.tcp_server_host}, port {args.tcp_server_port}')  # noqa: E501
        tcp_server = global_state_manager.get_tcp_server()

        tcp_server.initialize_server()
        logging.log(logging.INFO, 'Connect the application to run start.')
        out = tcp_server.wait_for_client()

        if out.status != Status.CLIENT_CONNECTED:
            logging.log(logging.WARNING, 'External application did not connect')  # noqa: E501

    # for now we have only one thread so the global state can't be corrupted
    socketio.run(
        app,
        port=args.backend_port,
        host=args.backend_host
    )


if __name__ == '__main__':
    main(sys.argv)
