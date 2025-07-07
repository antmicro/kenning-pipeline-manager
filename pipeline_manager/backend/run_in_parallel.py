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
from typing import Optional

from pipeline_manager.backend.state_manager import global_state_manager


def server_process_handler(
    frontend_path: Path,
    backend_host: str,
    backend_port: int,
    tcp_host: str,
    tcp_port: int,
    lazy_server_init: bool = False,
    relative_pm_url: Optional[Path] = None,
):
    """
    Function ran as a process target, responsible for initializing the tcp
    server, waiting for the client connection and running the backend.

    Parameters
    ----------
    frontend_path: Path
        Path where the built frontend is stored
    backend_host : str
        IPv4 address of the backend of Pipeline Manager
    backend_port : int
        Port of the backend of Pipeline Manager
    tcp_host: str
        IPv4 address from which the app will connect to third-party app
    tcp_port: int
        Port for connecting with third-party app
    lazy_server_init: bool
        Tells whether the server should connect first (False) or render
        the frontend without waiting for third-party app (True)
    relative_pm_url : Optional[Path]
        Path in URL where Pipeline Manager should be served
    """
    from pipeline_manager.backend.fastapi import create_app
    from pipeline_manager.backend.run_backend import run_uvicorn
    from pipeline_manager.backend.socketio import create_socketio

    app = create_app(frontend_path, relative_pm_url)
    sio = create_socketio()

    app.static_folder = Path(frontend_path).resolve()
    app.template_folder = Path(frontend_path).resolve()

    run_uvicorn(
        app,
        sio,
        backend_host,
        backend_port,
        tcp_host,
        tcp_port,
        lazy_server_init,
    )


async def start_server_in_parallel(
    frontend_path: Path,
    tcp_server_host: str = "127.0.0.1",
    tcp_server_port: int = 9000,
    backend_host: str = "127.0.0.1",
    backend_port: int = 5000,
    verbosity: str = "INFO",
    lazy_server_init: bool = False,
    relative_pm_url: Optional[Path] = None,
) -> int:
    """
    Wrapper function that starts a Pipeline Manager process in the background
    when called. The process can be stopped after calling
    'stop_parallel_server' or when the parent process ends.

    Parameters
    ----------
    frontend_path : Path
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
    lazy_server_init: bool
        Tells whether the connection with the third-party
        application should be established after connecting with
        the frontend (True) or immediately upon start (False)
    relative_pm_url : Optional[Path]
        Path in URL where Pipeline Manager should be served

    Returns
    -------
    int
        Index of the server process
    """
    logging.basicConfig(level=verbosity)
    await global_state_manager.reinitialize(tcp_server_port, tcp_server_host)

    index = len(global_state_manager.server_processes)
    global_state_manager.server_processes.append(
        Process(
            target=server_process_handler,
            args=(
                frontend_path,
                backend_host,
                backend_port,
                tcp_server_host,
                tcp_server_port,
                lazy_server_init,
                relative_pm_url,
            ),
        )
    )
    global_state_manager.server_processes[-1].start()
    return index


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
