# Copyright (c) 2022-2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with `pytest` configuration."""

import os
import signal
import subprocess
import tempfile
import time
from pathlib import Path

import pytest

SERVER_ADDRESS = "127.0.0.1"
SERVER_PORT = 5000
PROCESS_SHUTDOWN_TIME = 5

REPOSITORY_ROOT = Path(__file__).parents[2]


def pytest_addoption(parser: pytest.Parser):
    """Adds `pytest` parser options."""
    parser.addoption(
        "--frontend-directory",
        help="Server app frontend directory. By default, "
        "temporary directory is created",
    )
    parser.addoption(
        "--playwright-trace",
        help="If provided, playwright trace will be saved in a "
        "'<NAME>-<TIMESTAMP>.zip'",
    )


@pytest.fixture
def rpc_server(build_server_app: str):
    """Fixture to provide a backend server."""
    startup_time = 5
    process = None
    try:
        args = [
            str(REPOSITORY_ROOT / "run"),
            "--frontend-directory",
            str(build_server_app),
            "--backend-host",
            SERVER_ADDRESS,
            "--backend-port",
            str(SERVER_PORT),
        ]
        process = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            text=True,
            preexec_fn=os.setsid,
        )
        time.sleep(startup_time)
        yield
    except Exception as e:
        pytest.fail(f"Failed to start a RPC-JSON backend: {e}")
    finally:
        if process:
            # process group to ensure uvicorn shutdown
            process_group_id = os.getpgid(process.pid)
            os.killpg(process_group_id, signal.SIGTERM)
            time.sleep(PROCESS_SHUTDOWN_TIME)
            os.killpg(process_group_id, signal.SIGKILL)


@pytest.fixture(scope="session")
def build_server_app(request: pytest.FixtureRequest):
    """Context manager to build a server app in a temporary directory."""
    frontend_directory = request.config.getoption(
        "--frontend-directory",
        default=None,
    )
    if frontend_directory:
        yield frontend_directory
        return

    process = None
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            os.sync()
            args = [
                str(REPOSITORY_ROOT / "build"),
                "server-app",
                "--output-directory",
                tmp_dir,
            ]
            process = subprocess.Popen(args, cwd=REPOSITORY_ROOT)
            return_code = process.wait(timeout=100)
            assert not return_code, (
                "Building a server app failed."
                f"Return non-zero code: {return_code}"
            )
            yield tmp_dir
    finally:
        if process:
            process.terminate()
            time.sleep(PROCESS_SHUTDOWN_TIME)
            process.kill()
