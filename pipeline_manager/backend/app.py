# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import argparse
import json
import logging
import os
import sys
from http import HTTPStatus

from flask import Flask, render_template, request
from flask_cors import CORS
from pipeline_manager_backend_communication.misc_structures import MessageType, Status  # noqa: E501

from pipeline_manager import frontend
from pipeline_manager.backend.state_manager import global_state_manager

logging.basicConfig(level=logging.NOTSET)

dist_path = os.path.join(os.path.dirname(frontend.__file__), 'dist')

app = Flask(
    __name__,
    static_url_path='',
    static_folder=dist_path,
    template_folder=dist_path
)

# TODO: Change it later to our application exclusively
CORS(app)


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
        return 'Client connected', HTTPStatus.OK
    else:
        return 'Client not connected', HTTPStatus.SERVICE_UNAVAILABLE


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

    status = out.status
    if status == Status.DATA_READY:
        mess_type, dataflow = out.data
        return {'type': mess_type.value, 'content': json.loads(dataflow)}, HTTPStatus.OK  # noqa: E501
    if status == Status.CLIENT_DISCONNECTED:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501
    return 'Unknown error', HTTPStatus.SERVICE_UNAVAILABLE


@app.route('/connect', methods=['GET'])
def connect():
    """
    Endpoint used to start two-way communication TCP server that listens on
    a host and port specified by `host` and `port`.

    It returns once an external application is connected to it.

    If a connection already exists and a new request is made to this endpoint
    the connection is closed and a new one is initialized.

    Responses
    ---------
    HTTPStatus.OK :
        Request was successful and an external application was connected.
    HTTPStatus.SERVICE_UNAVAILABLE :
        External application did not connect.
    """
    tcp_server = global_state_manager.get_tcp_server()

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

    status = out.status
    if status == Status.DATA_READY:
        mess_type, specification = out.data
        return {'type': mess_type.value, 'content': json.loads(specification)}, HTTPStatus.OK  # noqa: E501
    if status == Status.CLIENT_DISCONNECTED:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501
    return 'Unknown error', HTTPStatus.SERVICE_UNAVAILABLE


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

    status = out.status
    if status == Status.DATA_READY:
        mess_type, message = out.data
        return {'type': mess_type.value, 'content': message}, HTTPStatus.OK  # noqa: E501
    if status == Status.CLIENT_DISCONNECTED:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501
    return 'Unknown error', HTTPStatus.SERVICE_UNAVAILABLE


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
    args, _ = parser.parse_known_args(argv[1:])

    global_state_manager.reinitialize(
        args.tcp_server_port,
        args.tcp_server_host
    )
    # for now we have only one thread so the global state can't be corrupted
    app.run(
        threaded=False,
        port=args.backend_port,
        host=args.backend_host
    )


if __name__ == '__main__':
    main(sys.argv)
