import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Dict
from deepdiff.diff import DeepDiff
from importlib.resources import files
from itertools import chain

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

    def request_specification(self) -> Dict:
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

    def validate_dataflow(self, dataflow: Dict) -> Dict:
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
        response_origin = self.client_origin.request('get_dataflow')
        response_copy = self.client_copy.request('get_dataflow')
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

    def frontend_connected(self) -> Dict:
        """
        RPC method that responses to frontend_connected request.

        Send current Dataflow from original Pipeline Manager to its copy.

        Returns
        -------
        Dict
            Method's response
        """
        response = self.client_origin.request('get_dataflow')
        if 'result' in response:
            self._redirect_changed('modify_dataflow', **{
                'dataflow': response['result']['dataflow']
            })
        elif 'error' in response:
            raise Exception(response['error']['message'])
        return {}

    def _redirect_changed(self, method: str, **kwargs) -> Dict:
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
        respose = self.client_copy.request(method, kwargs, non_blocking=False)
        if 'error' in respose:
            raise Exception(respose['error']['message'])
        return respose['result']


class RPCMethodsCopy(RPCMethodsBase):
    def request_specification(self) -> Dict:
        """
        RPC method that responses to Specification request.

        Set `notifyWhenChanged` metadata to prevent frontend from sending
        requests with information about changed values.

        Returns
        -------
        Dict
            Method's response
        """
        response = super().request_specification()
        metadata = response['content'].get('metadata', {})
        metadata['notifyWhenChanged'] = False
        response['content']['metadata'] = metadata
        return response


class RPCMethodsOriginal(RPCMethodsBase):
    def request_specification(self) -> Dict:
        """
        RPC method that responses to Specification request.

        Set `notifyWhenChanged` metadata to ensure frontend sends
        requests with information about changed values.

        Returns
        -------
        Dict
            Method's response
        """
        response = super().request_specification()
        metadata = response['content'].get('metadata', {})
        metadata['notifyWhenChanged'] = True
        response['content']['metadata'] = metadata
        return response

    # Methods receiving and redirecting requests with changed values
    def properties_changed(self, **kwargs) -> Dict:
        return self._redirect_changed('modify_properties', **kwargs)

    def position_changed(self, **kwargs) -> Dict:
        return self._redirect_changed('modify_position', **kwargs)

    def nodes_changed(self, **kwargs) -> Dict:
        # Make sure only nodes are removed
        # connections have designated event
        kwargs['remove_with_connections'] = False
        return self._redirect_changed('nodes_change', **kwargs)

    def connections_changed(self, **kwargs) -> Dict:
        return self._redirect_changed('modify_connections', **kwargs)

    def dataflow_changed(self, **kwargs) -> Dict:
        return self._redirect_changed('modify_dataflow', **kwargs)

    def metadata_changed(self, **kwargs) -> Dict:
        return self._redirect_changed('update_metadata', **kwargs)

    def apply_center(self) -> Dict:
        return self._redirect_changed('action_center')


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

    # Start second PM
    start_server_in_parallel(
        args.frontend_path,
        args.host,
        args.port_second,
        args.host,
        args.backend_port_second,
        args.verbosity,
    )

    # Set smaller timeout to enhance reaction time
    client_first = CommunicationBackend(
        args.host, args.port, receive_message_timeout=0.01)
    client_second = CommunicationBackend(args.host, args.port_second)
    # Start second PM backend
    client_second.initialize_client(RPCMethodsCopy(
        specification,
        client_first,
        client_second,
    ))
    client_second.start_json_rpc_client(separate_thread=True)

    time.sleep(0.5)
    # Start first PM backend
    client_first.initialize_client(RPCMethodsOriginal(
        specification,
        client_first,
        client_second,
    ))
    client_first.start_json_rpc_client(separate_thread=True)
    client_first.client_thread.join()
    client_second.client_thread.join()


if __name__ == "__main__":
    main(sys.argv)
