# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""Module with tests of subgraph switching."""

import logging
import multiprocessing
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import pytest
from playwright.sync_api import BrowserContext, sync_playwright

from pipeline_manager.backend.run_backend import create_backend, run_uvicorn
from pipeline_manager.frontend_builder import build_frontend

PROTOCOL = "http"
SERVER_ADDRESS = "127.0.0.1"
SERVER_PORT = 5000
TCP_SERVER_PORT = 9876
PROCESS_SHUTDOWN_TIME = 5

TASK_NAME = "Foo"


@pytest.fixture
def rpc_server(build_server_app: str):
    """Fixture to provide a backend server."""
    startup_time = 5
    process = None
    try:
        logging.info("Creating backend")
        sio, app, _ = create_backend(
            [
                "",
                "--frontend-directory",
                str(build_server_app),
                "--backend-host",
                SERVER_ADDRESS,
                "--backend-port",
                str(SERVER_PORT),
                "--tcp-server-port",
                str(TCP_SERVER_PORT),
            ]
        )
        process = multiprocessing.Process(
            target=run_uvicorn,
            args=(
                app,
                sio,
                "127.0.0.1",
                SERVER_PORT,
                "127.0.0.1",
                TCP_SERVER_PORT,
                False,
            ),
        )
        process.start()
        logging.info("Started backend")
        time.sleep(startup_time)
        yield
    except Exception as e:
        pytest.fail(f"Failed to start a RPC-JSON backend: {e}")
    finally:
        if process:
            # process group to ensure uvicorn shutdown
            process.terminate()
            time.sleep(PROCESS_SHUTDOWN_TIME)
            process.join()


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

    with tempfile.TemporaryDirectory() as tmp_dir:
        return_code = build_frontend(
            build_type="server-app", output_directory=Path(tmp_dir)
        )
        assert not return_code, (
            "Building a server app failed."
            f"Return non-zero code: {return_code}"
        )
        yield tmp_dir


def open_dialog_box(context: BrowserContext):
    """
    Execute a Playwright scenario, when an agents use
    custom user dialog.

    Parameters
    ----------
    context : BrowserContext
        An instance of Playwright context,
        on which the scenario will be performed.
    """
    page = context.new_page()
    page.set_viewport_size({"width": 1920, "height": 1080})
    page.goto(f"{PROTOCOL}://{SERVER_ADDRESS}:{SERVER_PORT}")
    button = page.locator("#navbar-button-custom_open_user_dialog_box")
    button.click()

    popup_menu = page.locator(".popup-menu").get_by_text("Task init")
    popup_menu.wait_for(state="visible")
    popup_menu = popup_menu.locator("..").locator("..")

    popup_input = popup_menu.get_by_title("task")
    popup_input.fill(TASK_NAME)

    button = popup_menu.get_by_role("button")
    button.click()

    popup_menu = page.locator(".popup_menu")
    popup_menu.wait_for(state="hidden")


@pytest.mark.flaky(retries=3, delay=1)
def test_custom_dialog(
    request: pytest.FixtureRequest,
    rpc_server,
):
    """
    Test if switching to a subgraph while utilizing RPC communication
    works.
    """
    args = ["python3", "pipeline_manager/frontend_tester/rpc_client.py"]
    client_process = None

    trace_name: Optional[str] = None
    tracing_path = request.config.getoption("--playwright-trace", default=None)
    if tracing_path:
        assert isinstance(tracing_path, str)
        path = Path(tracing_path)
        assert path.suffix == ".zip" or path.suffix == ""
        trace_name = path.stem

    subprocess_output = tempfile.TemporaryFile("wb+", 0)

    try:
        client_process = subprocess.Popen(
            args, stdout=subprocess_output, bufsize=1, text=True
        )
        with sync_playwright() as playwright:
            browser = playwright.firefox.launch()
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080}
            )
            if trace_name:
                context.tracing.start(
                    screenshots=True,
                    snapshots=True,
                    sources=True,
                )
            try:
                open_dialog_box(context)
                subprocess_output.seek(0)
                proc_output = subprocess_output.readline().decode()
                assert proc_output == f"Task: {TASK_NAME}"
            finally:
                if trace_name:
                    ts = datetime.now().strftime("%Y_%m_%d_%H_%M_%S")
                    context.tracing.stop(path=f"{trace_name}-{ts}.zip")
                    browser.close()
    except Exception as e:
        assert False, str(e)
    finally:
        if client_process is None:
            return
        client_process.terminate()
        time.sleep(PROCESS_SHUTDOWN_TIME)
        client_process.kill()
        subprocess_output.close()
