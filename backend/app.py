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

host = '127.0.0.1'
port = 9000
server = None

schema = None
schema_filename = './dataflow_schema.json'


@app.route('/', methods=['GET'])
def index():
    """
    Default GET enpoint that returns a simple frontend html file which
    works as a single page application.
    """
    return render_template('/index.html')


def load_specification(specification: Union[bytes, FileStorage]) -> bool:
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
    # TODO: Return more descriptive error codes

    try:
        specification = request.files['dataflow']
        specification = json.load(specification)
    except Exception:
        app.logger.exception('Dataflow is not a save')
        return jsonify(False)

    if specification is False:
        return jsonify(False)
    return specification


@app.route('/load_spec', methods=['POST'])
def load_spec():
    specification = request.files['specfile']
    specification = load_specification(specification)

    # TODO: Return more descriptive error codes
    if specification is False:
        return jsonify(False)
    return specification


@app.route("/connect")
def connect():
    global server

    if not server:
        server = PMServer(host, port)
    else:
        server.disconnect()

    server.initialize_server()
    out = server.wait_for_client()

    # TODO: Return more descriptive error codes
    return jsonify(out.status == Status.CLIENT_CONNECTED)


@app.route("/request_spec")
def request_spec():
    global server
    out = server.send_message(MessageType.SPECIFICATION)

    if out.status != Status.DATA_SENT:
        return jsonify(False)

    # TODO: Check for the client disconnecting and return more
    # descriptive error codes
    status = Status.NOTHING
    while status == Status.NOTHING:
        out = server.wait_for_response()
        status = out.status

    if status == Status.DATA_READY:
        mess_type, specification = out.data

        specification = load_specification(specification)

        if specification:
            return specification
        return jsonify(False)
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


if __name__ == "__main__":
    # for now we have only one thread so the global state can't be corrupted
    app.run(threaded=False)
