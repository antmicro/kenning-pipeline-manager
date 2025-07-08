# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Provides methods for starting Pipeline Manager server.
"""

import argparse
import logging
import sys
from pathlib import Path

import socketio
from fastapi import FastAPI
from pipeline_manager_backend_communication.misc_structures import (
    Status,
)
from uvicorn import run
from uvicorn.protocols.websockets.websockets_impl import WebSocketProtocol

from pipeline_manager.backend.fastapi import create_app, dist_path
from pipeline_manager.backend.socketio import create_socketio
from pipeline_manager.backend.state_manager import global_state_manager
from pipeline_manager.utils.logger import string_to_verbosity


def create_backend(argv):  # noqa: D103
    parser = argparse.ArgumentParser(argv[0])
    parser.add_argument(
        "--tcp-server-host",
        type=str,
        help="The address of the Pipeline Manager TCP Server",
        default="127.0.0.1",
    )
    parser.add_argument(
        "--tcp-server-port",
        type=int,
        help="The port of the Pipeline Manager TCP Server",
        default=9000,
    )
    parser.add_argument(
        "--backend-host",
        type=str,
        help="The address of the backend of Pipeline Manager",
        default="127.0.0.1",
    )
    parser.add_argument(
        "--backend-port",
        type=int,
        help="The port of the backend of Pipeline Manager",
        default=5000,
    )
    parser.add_argument(
        "--frontend-directory",
        help="Location of the built frontend. "
        "Used only when custom --output-directory was specified during "
        "building",
        type=Path,
    )
    parser.add_argument(
        "--relative-pm-url",
        help="Path in URL where Pipeline Manager should be served",
        type=Path,
    )
    parser.add_argument(
        "--skip-frontend",
        action="store_true",
        help="Creates server without frontend",
    )
    parser.add_argument(
        "--lazy-server-init",
        action="store_true",
        help="Connects to the third-party application after the first "
        "frontend connects",
    )
    parser.add_argument(
        "--verbosity",
        help="Verbosity level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default="INFO",
        type=str,
    )
    args, _ = parser.parse_known_args(argv[1:])
    logging.basicConfig(level=string_to_verbosity(args.verbosity))

    if (
        not args.skip_frontend
        and not dist_path.exists()
        and not args.frontend_directory
    ):
        logging.log(
            logging.ERROR,
            "Frontend files have not been found in the default directory.",
        )
        logging.log(
            logging.ERROR,
            "Build the frontend first or specify a custom path to the "
            "built frontend using --frontend-directory",
        )
        return

    sio = create_socketio()
    app = None
    if not args.skip_frontend:
        app = create_app(args.frontend_directory, args.relative_pm_url)

    return sio, app, args


def run_uvicorn(
    app: FastAPI,
    sio: socketio.AsyncServer,
    backend_host: str,
    backend_port: int,
    tcp_server_host: str,
    tcp_server_port: int,
    lazy_server_init: bool,
    verbosity: str = "INFO",
    **kwargs,
):
    """
    Runs uvicorn-based server for the frontend.

    Parameters
    ----------
    app : FastAPI
        Application to run
    sio : socketio.AsyncServer
        Asynchronous server base
    backend_host : str
        Host address
    backend_port : int
        Application port
    tcp_server_host : str
        Address for the third-party app
    tcp_server_port : int
        Port for the third-party app communication
    lazy_server_init : bool
        Tells whether server should immediately request connection
        with the third-party app (False) or skip waiting and progress
        with setting up other tasks and connect when the third-party
        app is ready (True)
    verbosity : str
        Verbosity level for the logger
    **kwargs
        Kwargs for the function
    """

    async def _startup():
        await startup(sio, tcp_server_host, tcp_server_port, lazy_server_init)

    app_asgi = socketio.ASGIApp(
        sio,
        other_asgi_app=app,
        on_startup=_startup,
        on_shutdown=shutdown,
    )
    run(
        app_asgi,
        host=backend_host,
        port=backend_port,
        ws=WebSocketProtocol,
        log_level=verbosity.lower(),
        loop="uvloop",
    )


async def startup(
    sio: socketio.AsyncServer, host: str, port: int, lazy_server_init: bool
) -> None:
    """
    Starts up the asynchronous server for Pipeline Manager.

    Parameters
    ----------
    sio : socketio.AsyncServer
        Asynchronous server to initialize connection
    host : str
        Host address
    port : int
        Port of the application
    lazy_server_init : bool
        Tells whether server should immediately request connection
        with the third-party app (False) or skip waiting and progress
        with setting up other tasks and connect when the third-party
        app is ready (True)

    Returns
    -------
    None
    """
    import asyncio

    global_state_manager.connecting_token = asyncio.Semaphore(1)
    await global_state_manager.reinitialize(port, host)
    await global_state_manager.tcp_server.initialize_server()

    if lazy_server_init:
        return

    # Initial listener for external app
    from pipeline_manager.backend.tcp_socket import start_socket_task

    async def init_connection():
        async with global_state_manager.connecting_token:
            tcp_server = global_state_manager.tcp_server

            out = await tcp_server.wait_for_client(
                tcp_server.receive_message_timeout
            )
            while (
                out.status != Status.CLIENT_CONNECTED
                and not global_state_manager.server_should_stop
            ):
                out = await tcp_server.wait_for_client(
                    tcp_server.receive_message_timeout
                )
            if out.status == Status.CLIENT_CONNECTED:
                # Socket reconnected, new thread
                # receiving messages has to be spawned
                start_socket_task(sio)

    asyncio.create_task(init_connection())


async def shutdown():
    """
    Shuts down the Pipeline Manager's server.
    """
    global_state_manager.server_should_stop = True
    await global_state_manager.tcp_server.disconnect()


def main(argv):  # noqa: D103
    sio, app, args = create_backend(argv)

    run_uvicorn(app, sio, **args.__dict__)


if __name__ == "__main__":
    main(sys.argv)
