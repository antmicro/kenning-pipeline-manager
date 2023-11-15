# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import argparse
import logging
import sys
import socketio
from pathlib import Path
from fastapi import FastAPI
from uvicorn import run
from uvicorn.protocols.websockets.websockets_impl import WebSocketProtocol

from pipeline_manager_backend_communication.misc_structures import Status

from pipeline_manager.backend.fastapi import create_app, dist_path
from pipeline_manager.backend.tcp_socket import start_socket_thread
from pipeline_manager.backend.socketio import create_socketio
from pipeline_manager.backend.state_manager import global_state_manager
from pipeline_manager.utils.logger import string_to_verbosity


def create_backend(argv):
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
        help="The adress of the backend of Pipeline Manager",
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
        "--skip-connecting",
        action="store_true",
        help="Specifies whether Pipeline Manager should wait "
        "for an external application to connect before running the backend",
    )
    parser.add_argument(
        "--skip-frontend",
        action="store_true",
        help="Creates server without frontend",
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

    if not args.skip_frontend and not dist_path.exists() and \
            not args.frontend_directory:
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
        app = create_app(args.frontend_directory)

    global_state_manager.reinitialize(
        args.tcp_server_port, args.tcp_server_host
    )
    tcp_server = global_state_manager.tcp_server
    tcp_server.initialize_server()
    if not args.skip_connecting:
        logging.info(
            f"Waiting for connection from third-party application on {args.tcp_server_host}, port {args.tcp_server_port}"  # noqa: E501
        )
        logging.log(logging.INFO, "Connect the application to run start.")
        out = tcp_server.wait_for_client()

        if out.status != Status.CLIENT_CONNECTED:
            logging.log(
                logging.WARNING,
                "External application did not connect"
            )
        start_socket_thread(sio)

    return sio, app, args


def run_uvicorn(
    app: FastAPI,
    sio: socketio.AsyncServer,
    host: str, port: int,
):
    app_asgi = socketio.ASGIApp(sio, other_asgi_app=app)
    run(
        app_asgi,
        host=host,
        port=port,
        ws=WebSocketProtocol,
        loop="asyncio",
    )


def main(argv):
    sio, app, args = create_backend(argv)

    run_uvicorn(app, sio, args.backend_host, args.backend_port)


if __name__ == "__main__":
    main(sys.argv)
