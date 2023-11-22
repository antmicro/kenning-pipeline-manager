# Copyright (c) 2020-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import asyncio
import argparse
import json
import logging
import sys
import socketio
from pathlib import Path
from typing import Dict
from deepdiff.diff import DeepDiff
from importlib.resources import files
from itertools import chain
from jsonrpc.jsonrpc2 import JSONRPC20Request

from pipeline_manager import frontend_tester, frontend
from pipeline_manager.utils.logger import string_to_verbosity
from pipeline_manager.backend.run_in_parallel import start_server_in_parallel

from pipeline_manager_backend_communication.communication_backend import (
    CommunicationBackend,
)
from pipeline_manager_backend_communication.misc_structures import (
    MessageType,
)


class RPCMethodsBase:
    def __init__(
        self,
        specification: Dict,
        client_origin: CommunicationBackend,
        client_copy: CommunicationBackend,
    ):
        self.specification = specification
        self.client_origin = client_origin
        self.client_copy = client_copy

    def specification_get(self) -> Dict:
        """
        RPC method that responses to Specification request.

        Returns
        -------
        Dict
            Method's response
        """
        logging.log(logging.INFO, "Sending specification.")
        return {
            'type': MessageType.OK.value,
            'content': self.specification,
        }

    async def dataflow_validate(self, dataflow: Dict) -> Dict:
        """
        RPC method that responses to Validate request.

        It gets Dataflows from both Pipeline Managers and checks
        if they are the same.

        Parameters
        ----------
        dataflow : Dict
            Content of the request.

        Returns
        -------
        Dict
            Method's response
        """
        response_origin = await self.client_origin.request('graph_get')
        response_copy = await self.client_copy.request('graph_get')
        # Ignore connections ID
        for connection in chain(
            response_origin['result']['dataflow']['graph']['connections'],
            response_copy['result']['dataflow']['graph']['connections'],
        ):
            del connection['id']
        if 'result' in response_origin and 'result' in response_copy:
            if (
                response_origin["result"]["dataflow"] ==
                response_copy["result"]["dataflow"]
            ):
                return {
                    'type': MessageType.OK.value,
                    'content': 'Both dataflows are the same',
                }
            diffs = DeepDiff(
                response_origin["result"]["dataflow"],
                response_copy["result"]["dataflow"]
            )
            return {
                'type': MessageType.ERROR.value,
                'content': f'Dataflows are not the same: {diffs}',
            }
        return {
            'type': MessageType.ERROR.value,
            'content': f'Error during `get_dataflow`: '
            f'{response_origin.get("error", "")} '
            f'{response_copy.get("error", "")}',
        }

    async def frontend_on_connect(self) -> Dict:
        """
        RPC method that responses to frontend_on_connect request.

        Send current Dataflow from original Pipeline Manager to its copy.

        Returns
        -------
        Dict
            Method's response
        """
        response = await self.client_origin.request('graph_get')
        if 'result' in response:
            await self._redirect_changed('graph_change', **{
                'dataflow': response['result']['dataflow']
            })
        elif 'error' in response:
            raise Exception(response['error']['message'])
        return {}

    async def _redirect_changed(self, method: str, **kwargs) -> Dict:
        """
        Redirects request to Pipeline Manager copy with changed method.

        Parameters
        ----------
        method : str
            Name of JSON-RPC method
        kwargs : Dict
            Content of the redirected request

        Returns
        -------
        Dict
            Response to the redirected request
        """
        response = await self.client_copy.request(method, kwargs)
        if 'error' in response:
            raise Exception(response['error']['message'])
        return response['result']


class RPCMethodsCopy(RPCMethodsBase):
    def specification_get(self) -> Dict:
        """
        RPC method that responses to Specification request.

        Set `notifyWhenChanged` metadata to prevent frontend from sending
        requests with information about changed values.

        Returns
        -------
        Dict
            Method's response
        """
        response = super().specification_get()
        metadata = response['content'].get('metadata', {})
        metadata['notifyWhenChanged'] = False
        response['content']['metadata'] = metadata
        return response


class RPCMethodsOriginal(RPCMethodsBase):
    def specification_get(self) -> Dict:
        """
        RPC method that responses to Specification request.

        Set `notifyWhenChanged` metadata to ensure frontend sends
        requests with information about changed values.

        Returns
        -------
        Dict
            Method's response
        """
        response = super().specification_get()
        metadata = response['content'].get('metadata', {})
        metadata['notifyWhenChanged'] = True
        response['content']['metadata'] = metadata
        return response

    # Methods receiving and redirecting requests with changed values
    async def properties_on_change(self, **kwargs) -> Dict:
        return await self._redirect_changed('properties_change', **kwargs)

    async def position_on_change(self, **kwargs) -> Dict:
        return await self._redirect_changed('position_change', **kwargs)

    async def nodes_on_change(self, **kwargs) -> Dict:
        # Make sure only nodes are removed
        # connections have designated event
        kwargs['remove_with_connections'] = False
        return await self._redirect_changed('nodes_change', **kwargs)

    async def connections_on_change(self, **kwargs) -> Dict:
        return await self._redirect_changed('connections_change', **kwargs)

    async def graph_on_change(self, **kwargs) -> Dict:
        return await self._redirect_changed('graph_change', **kwargs)

    async def metadata_on_change(self, **kwargs) -> Dict:
        return await self._redirect_changed('metadata_change', **kwargs)

    async def viewport_on_center(self) -> Dict:
        return await self._redirect_changed('viewport_center')


def main(argv):
    parser = argparse.ArgumentParser(argv[0])
    parser.add_argument(
        "--frontend-path",
        type=Path,
        help="The path to build Pipeline Manager frontend",
        default=None,
    )
    parser.add_argument(
        "--host",
        type=str,
        help="The address of the Pipeline Manager Server",
        default="127.0.0.1",
    )
    parser.add_argument(
        "--port",
        type=int,
        help="The port of the first Pipeline Manager Server",
        default=9000,
    )
    parser.add_argument(
        "--port-second",
        type=int,
        help="The port of the second Pipeline Manager Server",
        default=None,
    )
    parser.add_argument(
        "--backend-port",
        type=int,
        help="The port of the first Pipeline Manager Backend",
        default=5000,
    )
    parser.add_argument(
        "--backend-port-second",
        type=int,
        help="The port of the second Pipeline Manager Backend",
        default=5001,
    )
    parser.add_argument(
        "--verbosity",
        help="Verbosity level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default="DEBUG",
        type=str,
    )
    parser.add_argument(
        "--specification-path",
        type=Path,
        help="Path to specification JSON file",
        default=None,
    )
    args, _ = parser.parse_known_args(argv[1:])
    logging.basicConfig(level=string_to_verbosity(args.verbosity))

    if not args.port_second:
        args.port_second = args.port + 1

    if args.specification_path is None:
        spec_path = Path(frontend_tester.__file__).parent
        spec_path = spec_path / "frontend_tester_specification.json"
    else:
        spec_path = args.specification_path
    with open(spec_path) as f:
        specification = json.load(f)

    if not args.frontend_path:
        args.frontend_path = files(frontend) / 'dist'

    try:
        asyncio.run(_main(args, specification))
    except asyncio.CancelledError:
        pass


async def wait_for_frontend(host: str, port: int):
    """
    Waits until frontend connects to the serever.

    It creates SocketIO connection with server and
    asks how many connections are established.

    Parameters
    ----------
    host : str
        Server's address
    port : int
        Server's port
    """
    async with socketio.AsyncSimpleClient() as sio:
        await sio.connect(f'http://{host}:{port}')
        wait = True
        _id = 1
        while wait:
            await asyncio.sleep(1.)
            await sio.emit('backend-api', JSONRPC20Request(
                _id=_id,
                method='connected_frontends_get',
            ).data)
            response = await sio.receive()
            _id += 1
            wait = response[1]['result']['connections'] < 2


async def _main(args: argparse.Namespace, specification: Dict):
    # Start first PM
    await start_server_in_parallel(
        args.frontend_path,
        args.host,
        args.port,
        args.host,
        args.backend_port,
        args.verbosity,
    )
    # Start second PM
    await start_server_in_parallel(
        args.frontend_path,
        args.host,
        args.port_second,
        args.host,
        args.backend_port_second,
        args.verbosity,
    )
    await asyncio.sleep(3)
    # Wait for frontends
    logging.info(
        'Waiting for frontends to connect, please open browser on '
        f'http://{args.host}:{args.backend_port} and '
        f'http://{args.host}:{args.backend_port_second}'
    )
    await asyncio.gather(
        wait_for_frontend(args.host, args.backend_port),
        wait_for_frontend(args.host, args.backend_port_second),
    )

    client_first = CommunicationBackend(args.host, args.port)
    client_second = CommunicationBackend(args.host, args.port_second)
    # Start first PM backend
    await client_first.initialize_client(RPCMethodsOriginal(
        specification,
        client_first,
        client_second,
    ))
    task_first = client_first.loop.create_task(
        client_first.start_json_rpc_client()
    )
    await asyncio.sleep(0.5)

    # Start second PM backend
    await client_second.initialize_client(RPCMethodsCopy(
        specification,
        client_first,
        client_second,
    ))
    task_second = client_second.loop.create_task(
        client_second.start_json_rpc_client()
    )

    await asyncio.gather(task_first, task_second)


if __name__ == "__main__":
    main(sys.argv)
