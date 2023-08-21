# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Provides methods for running Pipeline Manager server in parallel.

Allows to run Pipeline Manager in parallel to the script
communicating with it.
"""

import logging
from multiprocessing import Process

from pipeline_manager_backend_communication.misc_structures import Status

from pipeline_manager.backend.state_manager import global_state_manager


def server_process_handler(backend_host: str, backend_port: int):
    """
    Function ran as a process target, responsible for initializing the tcp
    server, waiting for the client connection and running the backend

    Parameters
    ----------
    backend_host : str
        IPv4 address of the backend of Pipeline Manager
    backend_port : int
        Port of the backend of Pipeline Manager
    """

    tcp_server = global_state_manager.get_tcp_server()
    tcp_server.initialize_server()

    logging.log(logging.INFO, 'Connect the application to run start.')
    out = tcp_server.wait_for_client()

    if out.status != Status.CLIENT_CONNECTED:
        logging.log(logging.WARNING,
                    'External application did not connect')

    from pipeline_manager.backend.app import app
    app.run(backend_host, backend_port, threaded=False)


def start_server_in_parallel(
        tcp_server_host: str = '127.0.0.1',
        tcp_server_port: int = 9000,
        backend_host: str = '127.0.0.1',
        backend_port: int = 5000,
        verbosity: str = 'INFO'):
    """
    Wrapper function that starts a Pipeline Manager process in the background
    when called. The process can be stopped after calling
    'stop_parallel_server' or when the parent process ends.

    Parameters
    ----------
    tcp_server_host : str
        IPv4 of the server that is going to be used for the
        TCP server socket.
    tcp_server_port : int
        Application port that is going to be used for the
        TCP server socket.
    backend_host : str
        IPv4 address of the backend of Pipeline Manager
    backend_port : int
        Port of the backend of Pipeline Manager
    verbosity: str
        Logging verbosity level. Available options:
        ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
    """

    logging.basicConfig(level=verbosity)
    global_state_manager.reinitialize(tcp_server_port, tcp_server_host)

    global_state_manager.server_process = Process(
        target=server_process_handler,
        args=(backend_host, backend_port))
    global_state_manager.server_process.start()


def stop_parallel_server():
    """
    Gracefully terminates the parallel server process.
    """
    global_state_manager.server_process.terminate()


if __name__ == '__main__':
    start_server_in_parallel()
