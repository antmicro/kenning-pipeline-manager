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
"""

import argparse
from importlib.resources import open_text
import json
import logging
import time
from typing import Dict, List
import sys

from pipeline_manager import frontend_tester

from pipeline_manager_backend_communication.communication_backend import CommunicationBackend  # noqa: E501
from pipeline_manager_backend_communication.misc_structures import MessageType, Status  # noqa: E501


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
    args, _ = parser.parse_known_args(argv[1:])

    client = CommunicationBackend(args.host, args.port)
    client.initialize_client()

    specification_name = 'frontend_tester_specification.json'
    with open_text(frontend_tester, specification_name) as f:
        specification = json.load(f)

    text_to_message_type = {
        'OK': MessageType.OK,
        'ERROR': MessageType.ERROR
    }

    while client.connected:
        status, message = client.wait_for_message()
        if status == Status.DATA_READY:
            message_type, data = message

            if (message_type == MessageType.RUN or
                    message_type == MessageType.VALIDATE):
                try:
                    name = 'RunBehaviour' if message_type == MessageType.RUN else 'ValidationBehaviour'  # noqa: E501
                    logging.log(logging.INFO, f'Responding to {message_type} message')  # noqa: E501

                    properties = get_node_properties(name, data)
                    if properties['Disconnect']:
                        client.disconnect()
                    else:
                        effects = get_effects(name, data)
                        time.sleep(properties['Duration'])

                        client.send_message(
                            text_to_message_type[properties['MessageType']],
                            properties['Message'].encode(encoding='UTF-8')
                        )

                        for effect in effects:
                            if effect['name'] == 'Disconnect':
                                if effect['properties']['Should disconnect']:
                                    time.sleep(effect['properties']['Time offset'])  # noqa: E501
                                    logging.log(logging.INFO, 'Disconnecting!')
                                    client.disconnect()
                except Exception:
                    client.send_message(
                        MessageType.ERROR,
                        'No description provided'.encode(encoding='UTF-8')
                    )
            elif message_type == MessageType.SPECIFICATION:
                logging.log(logging.INFO, 'Sending specification.')
                client.send_message(
                    MessageType.OK,
                    json.dumps(specification).encode(encoding='UTF-8')
                )
            elif (message_type == MessageType.EXPORT or
                    message_type == MessageType.IMPORT):
                logging.log(logging.INFO, 'Import and Export message types are not supported')  # noqa: E501
                client.send_message(
                    MessageType.ERROR,
                    'Not implemented (yet)'.encode(encoding='UTF-8')
                )


if __name__ == '__main__':
    main(sys.argv)
