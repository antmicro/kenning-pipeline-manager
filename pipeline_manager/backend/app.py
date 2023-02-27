# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import argparse
import json
import logging
import os
import sys
from http import HTTPStatus
from typing import Union

from flask import Flask, render_template, request
from flask_cors import CORS
from jsonschema import ValidationError, validate
from pipeline_manager_backend_communication.misc_structures import MessageType, Status  # noqa: E501
from werkzeug.datastructures import FileStorage

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


def _load_specification(
        specification: Union[bytes, FileStorage]
        ) -> tuple[bool, Union[dict, str]]:
    """
    Loads specification that is given as an arguement and then validates
    it using a saved schema.

    Parameters
    ----------
    specification : Union[bytes, FileStorage]
        Specification given in bytes or FileStorage.

    Returns
    -------
    tuple[bool, Union[dict, str]] :
        Returns a tuple where the first element states whether the loading
        was succesful. If it was then the second element is
        a dataflow specification. Otherwise it is an exception message.
    """
    try:
        if isinstance(specification, bytes):
            specification = json.loads(specification)
        elif isinstance(specification, FileStorage):
            specification = json.load(specification)

        schema = global_state_manager.get_schema()
        validate(instance=specification, schema=schema)
    except ValidationError:
        app.logger.exception('Specification is invalid')
        return False, 'Specification is invalid'
    except (json.JSONDecodeError, UnicodeDecodeError):
        app.logger.exception('Specification is not a valid JSON')
        return False, 'Specification is not a valid JSON'

    return True, specification


@app.route('/get_status', methods=['GET'])
def get_status():
    """
    GET endpoint that returns connection status.

    Responses
    ---------
    HTTPStatus.OK :
        Request was successful and the response contains
        the parsed dataflow.
    HTTPStatus.SERVICE_UNAVAILABLE :
        Client was disconnected.
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
    to the Pipeline Manager.

    Responses
    ---------
    HTTPStatus.OK :
        Request was successful and the response contains
        the parsed dataflow.
    HTTPStatus.BAD_REQUEST :
        There was some error during the request handling.
        Response contains error message.
    HTTPStatus.SERVICE_UNAVAILABLE :
        External application was disconnected.
    """
    tcp_server = global_state_manager.get_tcp_server()
    if not tcp_server:
        return 'TCP server not initialized', HTTPStatus.BAD_REQUEST

    if not tcp_server.connected:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501

    dataflow = request.files['external_application_dataflow'].read()
    out = tcp_server.send_message(MessageType.IMPORT, dataflow)

    if out.status != Status.DATA_SENT:
        return 'Error while sending a message to the external application', HTTPStatus.BAD_REQUEST  # noqa: E501

    out = tcp_server.wait_for_message()

    status = out.status
    if status == Status.DATA_READY:
        mess_type, dataflow = out.data
        if mess_type != MessageType.OK:
            return 'Invalid message type from the external application', HTTPStatus.BAD_REQUEST  # noqa: E501

        return json.loads(dataflow), HTTPStatus.OK
    if status == Status.CLIENT_DISCONNECTED:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501
    return 'Unknown error', HTTPStatus.BAD_REQUEST


@app.route('/load_dataflow', methods=['POST'])
def load_dataflow():
    """
    POST endpoint that should be used to load a dataflow in Pipeline Manager
    format given in a form as a file attached with a name `dataflow`.

    Responses
    ---------
    HTTPStatus.OK :
        Request was successful and the response contains
        the loaded dataflow.
    HTTPStatus.BAD_REQUEST :
        There was some error during the request handling.
        Response contains error message.
    """
    try:
        dataflow = request.files['dataflow']
        dataflow = json.load(dataflow)
    except Exception:
        app.logger.exception('Dataflow is not a valid save')
        return 'Dataflow is not a valid save', HTTPStatus.BAD_REQUEST

    return dataflow, HTTPStatus.OK


@app.route('/load_specification', methods=['POST'])
def load_specification():
    """
    POST endpoint that should be used to load a dataflow specification
    given in a form as a file attached with a name `specfile`.

    Responses
    ---------
    HTTPStatus.OK :
        Request was successful and the response contains
        the specification.
    HTTPStatus.BAD_REQUEST :
        There was some error during the request handling.
        Response contains error message.
    """
    specification = request.files['specfile']
    success, specification = _load_specification(specification)

    if success:
        return specification, HTTPStatus.OK
    return specification, HTTPStatus.BAD_REQUEST


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
    HTTPStatus.BAD_REQUEST :
        External application did not connect.
    """
    tcp_server = global_state_manager.get_tcp_server()

    tcp_server.disconnect()
    tcp_server.initialize_server()
    out = tcp_server.wait_for_client()

    if out.status == Status.CLIENT_CONNECTED:
        return 'External application connected', HTTPStatus.OK
    return 'External application did not connect', HTTPStatus.BAD_REQUEST


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
        Request was successful and the response contains
        the specification from an external application.
    HTTPStatus.BAD_REQUEST :
        There was some error during the request handling.
        Response contains error message.
    HTTPStatus.SERVICE_UNAVAILABLE :
        External application was disconnected.
    """
    tcp_server = global_state_manager.get_tcp_server()

    if not tcp_server:
        return 'TCP server not initialized', HTTPStatus.BAD_REQUEST

    if not tcp_server.connected:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501

    out = tcp_server.send_message(MessageType.SPECIFICATION)

    if out.status != Status.DATA_SENT:
        return 'Error while sending a message to the external application', HTTPStatus.BAD_REQUEST  # noqa: E501

    out = tcp_server.wait_for_message()

    status = out.status
    if status == Status.DATA_READY:
        mess_type, specification = out.data
        if mess_type != MessageType.OK:
            return 'Invalid message type from the external application', HTTPStatus.BAD_REQUEST  # noqa: E501

        success, specification = _load_specification(specification)

        if success:
            return specification, HTTPStatus.OK
        return specification, HTTPStatus.BAD_REQUEST
    if status == Status.CLIENT_DISCONNECTED:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501
    return 'Unknown error', HTTPStatus.BAD_REQUEST


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
        Request was successful and the response contains
        feedback message
    HTTPStatus.BAD_REQUEST :
        There was some error during the request handling.
        Response contains error message.
    HTTPStatus.SERVICE_UNAVAILABLE :
        External application was disconnected.
    """
    tcp_server = global_state_manager.get_tcp_server()

    if not tcp_server:
        return 'TCP server not initialized', HTTPStatus.BAD_REQUEST

    if not tcp_server.connected:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501
    dataflow = request.form.get('dataflow')

    if request_type == 'validate':
        out = tcp_server.send_message(
            MessageType.VALIDATE,
            dataflow.encode(encoding='UTF-8')
        )
    elif request_type == 'run':
        out = tcp_server.send_message(
            MessageType.RUN,
            dataflow.encode(encoding='UTF-8')
        )
    elif request_type == 'export':
        out = tcp_server.send_message(
            MessageType.EXPORT,
            dataflow.encode(encoding='UTF')
        )
    else:
        return 'No request type specified', HTTPStatus.BAD_REQUEST

    if out.status != Status.DATA_SENT:
        return 'Error while sending a message to the external application', HTTPStatus.BAD_REQUEST  # noqa: E501

    out = tcp_server.wait_for_message()

    status = out.status
    if status == Status.DATA_READY:
        mess_type, message = out.data

        if mess_type == MessageType.OK:
            return message, HTTPStatus.OK
        if mess_type == MessageType.ERROR:
            return message, HTTPStatus.BAD_REQUEST

    if status == Status.CLIENT_DISCONNECTED:
        return 'External application is disconnected', HTTPStatus.SERVICE_UNAVAILABLE  # noqa: E501
    return 'Unknown error', HTTPStatus.BAD_REQUEST


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
