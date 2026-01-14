"""Module with tests of subgraph switching."""

import os
import signal
import subprocess
import tempfile
import time
from pathlib import Path

import pytest
from playwright.sync_api import Page, Playwright, expect, sync_playwright

PROTOCOL = "http"
SERVER_ADDRESS = "127.0.0.1"
SERVER_PORT = 5000
PROCESS_SHUTDOWN_TIME = 5


@pytest.fixture
def rpc_server(build_server_app: str):
    """Fixture to provide a backend server."""
    startup_time = 5
    process = None
    try:
        args = [
            "./run",
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
def build_server_app():
    """Context manager to build a server app in a temporary directory."""
    process = None
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            os.sync()
            args = [
                "./build",
                "server-app",
                "--output-directory",
                tmp_dir,
            ]
            process = subprocess.Popen(args)
            return_code = process.wait(timeout=50)
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


@pytest.fixture(scope="session")
def install_playwright_browser():
    """
    Fixture installing Firefox required for tests with Playwright.
    """
    os.system("playwright install firefox --with-deps")


def upload_dataflow_file(
    page: Page,
):
    """Upload either a JSON dataflow file to the frontend."""
    with page.expect_file_chooser() as fc_info:
        page.mouse.move(25, 25)
        text = "Load graph file"
        page.get_by_text(text).click()

    file_chooser = fc_info.value
    file_path = Path("./examples/sample-subgraph-dataflow.json")
    file_chooser.set_files(str(file_path))


def enter_subgraph_node(page: Page):
    """Navigate to a subgraph node."""
    page.locator(
        ".node-container "
        ".baklava-node[data-node-type='Test subgraph #1'] "
        ".__title"
    ).nth(0).click(button="right")
    contextMenuOption = page.locator(".baklava-context-menu").get_by_text(
        "Go to graph"
    )
    contextMenuOption.click()


def execute_enter_subgraph_scenario(playwright: Playwright):
    """
    Execute a Playwright scenario, when an agents enters a subgraph,
    utilizing the frontend.

    Parameters
    ----------
    playwright : Playwright
        An instance of Playwright context manager,
        on which the scenario will be performed.
    """
    browser = playwright.firefox.launch()
    page = browser.new_page()
    page.goto(f"{PROTOCOL}://{SERVER_ADDRESS}:{SERVER_PORT}")
    upload_dataflow_file(page)

    nodes = page.locator(".node-container > div")
    expect(nodes).to_have_count(4)

    enter_subgraph_node(page)

    expect(nodes).to_have_count(2)
    browser.close()


@pytest.mark.flaky(retries=3, delay=1)
def test_subgraph_switching(rpc_server, install_playwright_browser):
    """
    Test if switching to a subgraph while utilizing RPC communication
    works.
    """
    args = ["python3", "pipeline_manager/frontend_tester/rpc_client.py"]
    try:
        client_process = subprocess.Popen(args)
        with sync_playwright() as playwright:
            execute_enter_subgraph_scenario(playwright)
    except Exception as e:
        assert False, str(e)
    finally:
        if client_process is None:
            return
        client_process.terminate()
        time.sleep(PROCESS_SHUTDOWN_TIME)
        client_process.kill()
