# Copyright (c) 2022-2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with `pytest` configuration."""

import fcntl
import os
import signal
import subprocess
import time
from datetime import datetime
from pathlib import Path

import pytest
from playwright.sync_api import BrowserContext, sync_playwright

from pipeline_manager.utils.ports import get_free_port

PROTOCOL = "http"
SERVER_ADDRESS = "127.0.0.1"
PROCESS_SHUTDOWN_TIME = 5
BUILD_TIMEOUT = 300

REPOSITORY_ROOT = Path(__file__).parents[2]


def pytest_addoption(parser: pytest.Parser):
    """Adds `pytest` parser options."""
    parser.addoption(
        "--frontend-directory",
        default=None,
        help="Server app frontend directory. By default, "
        "temporary directory is created",
    )
    parser.addoption(
        "--playwright-trace-dir",
        default="playwright-traces",
        help="Directory where playwright traces are saved as "
        "'<TEST_NAME>-<TIMESTAMP>.zip'",
    )
    parser.addoption(
        "--no-playwright-trace",
        action="store_true",
        default=False,
        help="Disable collecting playwright traces",
    )


@pytest.fixture
def backend_port() -> int:
    """Free port for the Pipeline Manager backend."""
    return get_free_port(SERVER_ADDRESS)


@pytest.fixture
def tcp_server_port() -> int:
    """Free port for the Pipeline Manager TCP server."""
    return get_free_port(SERVER_ADDRESS)


@pytest.fixture
def browser_context(request: pytest.FixtureRequest):
    """
    Fixture to provide a Firefox browser context.
    """
    trace = not request.config.getoption("--no-playwright-trace")
    with sync_playwright() as playwright:
        browser = playwright.firefox.launch()
        try:
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080}
            )
            if trace:
                context.tracing.start(
                    screenshots=True,
                    snapshots=True,
                    sources=True,
                )
            try:
                yield context
            finally:
                if trace:
                    trace_dir = Path(
                        request.config.getoption("--playwright-trace-dir")
                    )
                    ts = datetime.now().strftime("%Y_%m_%d_%H_%M_%S")
                    context.tracing.stop(
                        path=trace_dir / f"{request.node.name}-{ts}.zip"
                    )
        finally:
            browser.close()


@pytest.fixture
def page(rpc_server, browser_context: BrowserContext, backend_port: int):
    """Fixture to provide a Firefox page with the frontend opened."""
    page = browser_context.new_page()
    page.goto(f"{PROTOCOL}://{SERVER_ADDRESS}:{backend_port}")
    return page


@pytest.fixture
def rpc_server(build_server_app: str, backend_port: int, tcp_server_port: int):
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
            str(backend_port),
            "--tcp-server-port",
            str(tcp_server_port),
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


def _run_server_app_build(output_directory: Path):
    """
    Builds the server app into `output_directory`.

    `npm install` is skipped when `node_modules` is already present
    (e.g. installed by `just build-frontend`).
    """
    args = [
        str(REPOSITORY_ROOT / "build"),
        "server-app",
        "--output-directory",
        str(output_directory),
    ]
    if (REPOSITORY_ROOT / "pipeline_manager/frontend/node_modules").is_dir():
        args.append("--skip-install-deps")

    process = subprocess.Popen(args, cwd=REPOSITORY_ROOT)
    try:
        return_code = process.wait(timeout=BUILD_TIMEOUT)
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=PROCESS_SHUTDOWN_TIME)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
    assert (
        not return_code
    ), f"Building a server app failed. Return non-zero code: {return_code}"


@pytest.fixture(scope="session")
def build_server_app(
    request: pytest.FixtureRequest,
    tmp_path_factory: pytest.TempPathFactory,
):
    """
    Builds the server app once per test run.
    """
    frontend_directory = request.config.getoption(
        "--frontend-directory",
        default=None,
    )
    if frontend_directory:
        yield frontend_directory
        return

    if os.environ.get("PYTEST_XDIST_WORKER"):
        # Parent of worker's basetemp is shared by all workers of this run
        shared_root = tmp_path_factory.getbasetemp().parent
    else:
        shared_root = tmp_path_factory.mktemp("server-app-build")

    output_directory = shared_root / "server-app"
    done_marker = shared_root / "server-app.done"
    failed_marker = shared_root / "server-app.failed"

    with open(shared_root / "server-app.lock", "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            if failed_marker.exists():
                pytest.fail("Building a server app failed in another worker")
            if not done_marker.exists():
                try:
                    _run_server_app_build(output_directory)
                except BaseException:
                    failed_marker.touch()
                    raise
                done_marker.touch()
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)

    yield str(output_directory)
