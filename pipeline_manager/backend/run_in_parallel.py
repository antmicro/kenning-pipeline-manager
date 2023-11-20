# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Provides methods for running Pipeline Manager server in parallel.

Allows to run Pipeline Manager in parallel to the script
communicating with it.
"""

import asyncio
import logging
from multiprocessing import Process
from pathlib import Path

from pipeline_manager.backend.state_manager import global_state_manager


def server_process_handler(
    frontend_path: Path, backend_host: str, backend_port: int,
    tcp_host: str, tcp_port: int,
):
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

    from pipeline_manager.backend.fastapi import create_app
    from pipeline_manager.backend.socketio import create_socketio
    from pipeline_manager.backend.run_backend import run_uvicorn
    app = create_app(frontend_path)
    sio = create_socketio()

    app.static_folder = Path(frontend_path).resolve()
    app.template_folder = Path(frontend_path).resolve()

    run_uvicorn(app, sio, backend_host, backend_port, tcp_host, tcp_port)


async def start_server_in_parallel(
    frontend_path: Path,
    tcp_server_host: str = "127.0.0.1",
    tcp_server_port: int = 9000,
    backend_host: str = "127.0.0.1",
    backend_port: int = 5000,
    verbosity: str = "INFO",
):
    """
    Wrapper function that starts a Pipeline Manager process in the background
    when called. The process can be stopped after calling
    'stop_parallel_server' or when the parent process ends.

    Parameters
    ----------
    frontend_path : Path,
        Path where the built frontend files are stored.
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
    await global_state_manager.reinitialize(tcp_server_port, tcp_server_host)

    global_state_manager.server_processes.append(Process(
        target=server_process_handler,
        args=(frontend_path, backend_host, backend_port,
              tcp_server_host, tcp_server_port),
    ))
    global_state_manager.server_processes[-1].start()


def stop_parallel_server(process_index: int):
    """
    Gracefully terminates the parallel server process.

    Parameters
    ----------
    process_index : int
        Index of the process that should be terminated
    """
    global_state_manager.server_processes[process_index].terminate()


if __name__ == "__main__":
    asyncio.run(start_server_in_parallel())
