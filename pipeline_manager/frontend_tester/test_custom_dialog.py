# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""Module with tests of subgraph switching."""

import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import pytest
from playwright.sync_api import BrowserContext, expect, sync_playwright

PROTOCOL = "http"
SERVER_ADDRESS = "127.0.0.1"
PROCESS_SHUTDOWN_TIME = 5
CLIENTS_DIRECTORY = Path(__file__).parent / "clients"

TASK_NAME = "Foo"
ANOTHER_TASK_NAME = "Boo"


def open_and_override_dialog_box(context: BrowserContext, port: int):
    """
    Execute a Playwright scenario, when an agents use
    custom user dialog.

    Parameters
    ----------
    context : BrowserContext
        An instance of Playwright context,
        on which the scenario will be performed.
    port : int
        Port of the Pipeline Manager backend.
    """
    page = context.new_page()
    page.set_viewport_size({"width": 1920, "height": 1080})
    page.goto(f"{PROTOCOL}://{SERVER_ADDRESS}:{port}")
    open_box = page.locator("#navbar-button-custom_open_user_dialog_box")
    open_box.click()

    popup_menu = page.locator(".popup-menu").get_by_text("Task init")
    popup_menu.wait_for(state="visible")
    popup_menu = popup_menu.locator("..").locator("..")

    popup_input = popup_menu.get_by_title("task")
    popup_input.fill(TASK_NAME)

    button = popup_menu.get_by_role("button")
    button.click()

    popup_menu = page.locator(".popup_menu")
    popup_menu.wait_for(state="hidden")
    popup_menu = popup_menu.locator("..").locator("..")

    # replace dialog box
    change_button = page.locator(
        "#navbar-button-custom_change_user_dialog_box"
    )
    change_button.click()
    # open dialog box and check if a new inputs are there
    open_box.click()

    popup_menu = page.locator(".popup-menu").get_by_text("Task init")
    popup_menu.wait_for(state="visible")
    popup_menu = popup_menu.locator("..").locator("..")

    popup_input = popup_menu.get_by_title("new task")
    expect(popup_input).to_be_visible()
    popup_input.fill(ANOTHER_TASK_NAME)
    popup_input = popup_menu.get_by_title("count")
    expect(popup_input).to_be_visible()

    button = popup_menu.get_by_role("button")
    button.click()

    popup_menu = page.locator(".popup_menu")
    popup_menu.wait_for(state="hidden")


def add_remove_dialog_box(context: BrowserContext, port: int):
    """
    Execute a Playwright scenario, when an agents add and
    removes dialog box.

    Parameters
    ----------
    context : BrowserContext
        An instance of Playwright context,
        on which the scenario will be performed.
    port : int
        Port of the Pipeline Manager backend.
    """
    page = context.new_page()
    page.set_viewport_size({"width": 1920, "height": 1080})
    page.goto(f"{PROTOCOL}://{SERVER_ADDRESS}:{port}")
    # Try to open dialog box and make sure it is not added
    open_box = page.locator("#navbar-button-custom_open_user_dialog_box")
    open_box.click()

    popup_menu = page.locator(".popup-menu").get_by_text("Task init")
    expect(popup_menu).not_to_be_visible()

    add_box = page.locator("#navbar-button-custom_add_user_dialog_box")
    add_box.click()

    open_box.click()
    expect(popup_menu).to_be_visible()
    popup_menu = popup_menu.locator("..").locator("..")
    popup_input = popup_menu.get_by_title("task")
    popup_input.fill(TASK_NAME)

    button = popup_menu.get_by_role("button")
    button.click()

    popup_menu = page.locator(".popup_menu")
    popup_menu.wait_for(state="hidden")
    popup_menu = popup_menu.locator("..").locator("..")

    # remove dialog box
    rm_button = page.locator("#navbar-button-custom_rm_user_dialog_box")
    rm_button.click()
    # open dialog box and check if a new inputs are there
    open_box.click()

    popup_menu = page.locator(".popup-menu").get_by_text("Task init")
    expect(popup_menu).not_to_be_visible()


@pytest.mark.flaky(retries=3, delay=1)
def test_custom_dialog(
    request: pytest.FixtureRequest,
    rpc_server,
    backend_port: int,
    tcp_server_port: int,
):
    """
    Test basic custom dialog boxes capabilities.
    """
    args = [
        "python3",
        str(CLIENTS_DIRECTORY / "subgraph_switching_client.py"),
        str(tcp_server_port),
    ]
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
                open_and_override_dialog_box(context, backend_port)
                subprocess_output.seek(0)
                proc_output = subprocess_output.readline().decode()
                assert (
                    proc_output
                    == f"Task: {TASK_NAME}Task: {ANOTHER_TASK_NAME}"
                )
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


@pytest.mark.flaky(retries=3, delay=1)
def test_custom_dialog_add_and_rm(
    request: pytest.FixtureRequest,
    rpc_server,
    backend_port: int,
    tcp_server_port: int,
):
    """
    Test custom dialog addition and removal.
    """
    args = [
        "python3",
        str(CLIENTS_DIRECTORY / "custom_dialog_client.py"),
        str(tcp_server_port),
    ]
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
                add_remove_dialog_box(context, backend_port)
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
