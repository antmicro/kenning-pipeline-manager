# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with utilities for choosing network ports."""

import socket


def get_free_port(host: str = "127.0.0.1") -> int:
    """
    Get a port that is currently not used by any process.

    Parameters
    ----------
    host : str
        Address on which the port should be free

    Returns
    -------
    int
        Free port number
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        return sock.getsockname()[1]
