#!/usr/bin/env python

# Copyright (c) 2020-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Module used to test frontend part of Pipeline Manager.

It simulates behaviour of a regular external application, by allowing
to choose how it responds to different requests and message types.

Run in the root directory:
```bash
python -m pipeline_manager.frontend_tester.tester_client
```

It support all MessageTypes.

* MessageType.VALIDATION, MessageType.RUN and MessageType.EXPORT - Frontend
tester checks appropriate nodes in the dataflow, that are customizable and can
be adjusted to change the behaviour of the application.

* MessageType.SPECIFICATION - Frontend tester sends OK response that contains
its specification

* MessageType.IMPORT - Frontend tester sends OK response that contains the
data sent to it. It simply returns a received file.
"""

import argparse
from importlib.resources import open_text
import json
import logging
import time
from pathlib import Path
from typing import Dict, List
import sys

from pipeline_manager import frontend_tester

from pipeline_manager_backend_communication.communication_backend import CommunicationBackend  # noqa: E501
from pipeline_manager_backend_communication.misc_structures import MessageType  # noqa: E501


logging.basicConfig(level=logging.NOTSET)


def get_node_properties(name: str, dataflow: Dict) -> Dict:
    """
    Function that reads properties of a `name` node in `dataflow`.
    It is assumed for now that we have only such node in the `dataflow`.

    Parameters
    ----------
    name : str
        Properties of the `name` node are going to be read and returned
        as a dictionary.
    dataflow : Dict
        Dataflow that was sent by Pipeline Manager.

    Returns
    -------
    Dict :
        Dictionary that has all properties of a `name` node.
    """
    dataflow = json.loads(dataflow)
    nodes = dataflow['nodes']
    description_node = None

    for node in nodes:
        if node['name'] == name:
            description_node = node
            break

    properties = {}
    for option in description_node['options']:
        name, value = option
        properties[name] = value

    return properties


def get_effects(name: str, dataflow: Dict) -> List:
    """
    Function that returns all connected nodes to a `name`
    node in the dataflow.

    Parameters
    ----------
    name : str
        Nodes connected to the `name` node are returned.
    dataflow : Dict
        Dataflow that was sent by Pipeline Manager.

    Returns
    -------
    List :
        List of nodes connected to `name` node.
    """
    dataflow = json.loads(dataflow)
    nodes = dataflow['nodes']
    connections = dataflow['connections']
    socket_id = None

    for node in nodes:
        if node['name'] == name:
            socket_id = node['interfaces'][0][1]['id']
            break

    connected_nodes_id = []
    for connection in connections:
        if connection['from'] == socket_id:
            connected_nodes_id.append(connection['to'])

    connected_nodes = []
    for node in nodes:
        if node['interfaces'][0][1]['id'] in connected_nodes_id:
            connected_nodes.append(node)

    parsed_nodes = []
    for node in connected_nodes:
        parsed_nodes.append(
            {
                'name': node['name'],
                'properties': {
                    option[0]: option[1] for option in node['options']
                }
            }
        )
    return parsed_nodes


def text_to_message_type(text):
    return {
        'OK': MessageType.OK,
        'ERROR': MessageType.ERROR
    }[text]


def import_response(message_type, data, client):
    client.send_message(
        MessageType.OK,
        data
    )


def specification_response(message_type, data, client, specification):
    logging.log(logging.INFO, 'Sending specification.')
    client.send_message(
        MessageType.OK,
        json.dumps(specification).encode(encoding='UTF-8')
    )


def run_validate_response(message_type, data, client):
    message_type_to_node_name = {
        MessageType.RUN: 'RunBehaviour',
        MessageType.VALIDATE: 'ValidationBehaviour',
    }

    try:
        name = message_type_to_node_name[message_type]
        properties = get_node_properties(name, data)
    except Exception:
        client.send_message(
            MessageType.ERROR,
            f'No description for {str(message_type)} provided'.encode(encoding='UTF-8')  # noqa: E501
        )
        return
    if properties['Disconnect']:
        client.disconnect()
        return

    if message_type == MessageType.RUN:
        steps = properties['ProgressMessages']
        time_offset = properties['Duration'] / steps
        for i in range(1, steps + 1):
            progress = str(i / steps * 100)
            logging.log(logging.INFO, f'Progress: {progress}')
            client.send_message(
                MessageType.PROGRESS,
                progress.encode('UTF-8')
            )
            time.sleep(time_offset)
    else:
        time.sleep(properties['Duration'])

    client.send_message(
        text_to_message_type(properties['MessageType']),
        properties['Message'].encode(encoding='UTF-8')
    )

    effects = get_effects(name, data)
    for effect in effects:
        if effect['name'] == 'Disconnect':
            if effect['properties']['Should disconnect']:
                time.sleep(effect['properties']['Time offset'])
                logging.log(logging.INFO, 'Disconnecting!')
                client.disconnect()


def export_response(message_type, data, client, output_path):
    name = 'ExportBehaviour'
    try:
        properties = get_node_properties(name, data)
    except Exception:
        client.send_message(
            MessageType.ERROR,
            f'No description for {str(message_type)} provided'.encode(encoding='UTF-8')  # noqa: E501
        )
        return
    if properties['Disconnect']:
        client.disconnect()
        return

    time.sleep(properties['Duration'])

    with open(output_path, 'w') as f:
        json.dump(json.loads(data), f, indent=4)
    logging.log(logging.INFO, f'Exported dataflow stored in {output_path}')
    client.send_message(
        text_to_message_type[properties['MessageType']],
        properties['Message'].encode(encoding='UTF-8')
    )


def main(argv):
    parser = argparse.ArgumentParser(argv[0])
    parser.add_argument(
        '--host',
        type=str,
        help='The address of the Pipeline Manager Server',
        default='127.0.0.1'
    )
    parser.add_argument(
        '--port',
        type=int,
        help='The port of the Pipeline Manager Server',
        default=9000
    )
    parser.add_argument(
        '--output-path',
        type=Path,
        help='Path were exported dataflows are saved',
        default='output.json'
    )
    args, _ = parser.parse_known_args(argv[1:])

    client = CommunicationBackend(args.host, args.port)
    client.initialize_client()

    specification_name = 'frontend_tester_specification.json'
    with open_text(frontend_tester, specification_name) as f:
        specification = json.load(f)

    client.register_callback(MessageType.IMPORT, import_response)
    client.register_callback(MessageType.SPECIFICATION, specification_response, specification)  # noqa: E501
    client.register_callback(MessageType.RUN, run_validate_response)
    client.register_callback(MessageType.VALIDATE, run_validate_response)
    client.register_callback(MessageType.EXPORT, export_response, args.output_path)  # noqa: E501

    while client.connected:
        _, _ = client.wait_for_message()


if __name__ == '__main__':
    main(sys.argv)
