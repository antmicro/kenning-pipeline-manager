from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

import json
from typing import Union
from werkzeug.datastructures import FileStorage
from jsonschema import validate, ValidationError
from server import PMServer, MessageType, Status

app = Flask(
    __name__,
    static_url_path='',
    static_folder='./frontend',
    template_folder='./frontend'
)

# TODO: Change it later to our application exclusively
CORS(app, resources={r'/*': {'origins': '*'}})

# TCP Server specification
host = '127.0.0.1'
port = 9000
server = None

# Schema to validate against
schema = None
schema_filename = './dataflow_schema.json'


@app.route('/', methods=['GET'])
def index():
    """
    Default GET enpoint that returns a simple frontend html file which
    works as a single page application.
    """
    return render_template('/index.html')


def _load_specification(
        specification: Union[bytes, FileStorage]
        ) -> Union[bool, dict]:
    """
    Loads specification that is given as an arguement and then validates
    it using a saved schema.

    Parameters
    ----------
    specification : Union[bytes, FileStorage]
        Specification given in bytes or FileStorage.

    Returns
    -------
    Union[bool, dict]
        Returns bool if loading or validating was unsuccessful. Otherwise
        a valid specification is returned.
    """
    global schema

    if not schema:
        with open(schema_filename, 'r') as f:
            schema = json.load(f)

    try:
        if isinstance(specification, bytes):
            specification = json.loads(specification)
        elif isinstance(specification, FileStorage):
            specification = json.load(specification)
        validate(instance=specification, schema=schema)
    except ValidationError:
        app.logger.exception('Specification is invalid')
        return False
    except Exception:
        app.logger.exception('Specification is not a valid JSON')
        return False

    return specification


@app.route('/load_dataflow', methods=['POST'])
def load_dataflow():
    """
    POST endpoint that should be used to load and validate a dataflow
    given in a form as a file attached with a name `dataflow`.

    Returns
    -------
    TODO: Return more descriptive error codes
    """
    try:
        specification = request.files['dataflow']
        specification = json.load(specification)
    except Exception:
        app.logger.exception('Dataflow is not a save')
        return jsonify(False)

    if specification is False:
        return jsonify(False)
    return specification


@app.route('/load_specification', methods=['POST'])
def load_specification():
    """
    POST endpoint that should be used to load a dataflow specification
    given in a form as a file attached with a name `specfile`.

    Returns
    -------
    # TODO: Return more descriptive error codes
    """
    specification = request.files['specfile']
    specification = _load_specification(specification)

    if specification is False:
        return jsonify(False)
    return specification


@app.route('/connect', methods=['GET'])
def connect():
    """
    Endpoint used to start two-way communication TCP server that listens on
    a host and port specified by `host` and `port`.

    It returns once a client is connected to it.

    If a connection already exists and a new request is made to this endpoint
    the connection is closed and a new one is initialized.

    Returns
    -------
    # TODO: Return more descriptive error codes
    """
    global server

    if not server:
        server = PMServer(host, port)
    else:
        server.disconnect()

    server.initialize_server()
    out = server.wait_for_client()

    return jsonify(out.status == Status.CLIENT_CONNECTED)


@app.route('/request_specification', methods=['GET'])
def request_specification():
    """
    GET endpoint that should be used to request a dataflow specification
    from an external application.

    A communication has to be established first with a `connect`
    endpoint first.

    Returns
    -------
    # TODO: Return more descriptive error codes
    """
    global server
    out = server.send_message(MessageType.SPECIFICATION)

    if out.status != Status.DATA_SENT:
        return jsonify(False)

    status = Status.NOTHING
    while status == Status.NOTHING:
        out = server.wait_for_response()
        status = out.status

    if status == Status.DATA_READY:
        mess_type, specification = out.data

        specification = _load_specification(specification)

        if specification:
            return specification
    return jsonify(False)


@app.errorhandler(404)
def default_handler(e):
    """
    Handler that returns the same thing as the default GET endpoint.

    Because it is a single page application the routing is managed by the
    frontend side. Every requests to the backend returns the same html page and
    only then the route is handled by the browser.
    """
    return render_template('/index.html')


if __name__ == '__main__':
    # for now we have only one thread so the global state can't be corrupted
    app.run(threaded=False, port=5000)
