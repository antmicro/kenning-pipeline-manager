"""Module with tests of subgraph switching."""

import os
import signal
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import pytest
from playwright.sync_api import BrowserContext, Page, expect, sync_playwright

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
                "./build",
                "server-app",
                "--output-directory",
                tmp_dir,
            ]
            process = subprocess.Popen(args)
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
    node = page.locator(
        ".node-container .baklava-node[data-node-type='Test subgraph #1'] ",
    ).nth(0)
    node.locator(".__title").click(button="right")
    contextMenuOption = node.locator(".baklava-context-menu").get_by_text(
        "Go to graph"
    )
    contextMenuOption.click()


def execute_enter_subgraph_scenario(context: BrowserContext):
    """
    Execute a Playwright scenario, when an agents enters a subgraph,
    utilizing the frontend.

    Parameters
    ----------
    context : BrowserContext
        An instance of Playwright context,
        on which the scenario will be performed.
    """
    page = context.new_page()
    page.goto(f"{PROTOCOL}://{SERVER_ADDRESS}:{SERVER_PORT}")
    upload_dataflow_file(page)

    nodes = page.locator(".node-container > div")
    expect(nodes).to_have_count(4)

    enter_subgraph_node(page)

    expect(nodes).to_have_count(2)


@pytest.mark.flaky(retries=3, delay=1)
def test_subgraph_switching(
    request: pytest.FixtureRequest,
    rpc_server,
    install_playwright_browser,
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

    try:
        client_process = subprocess.Popen(args)
        with sync_playwright() as playwright:
            browser = playwright.firefox.launch()
            context = browser.new_context()
            if trace_name:
                context.tracing.start(
                    screenshots=True,
                    snapshots=True,
                    sources=True,
                )
            try:
                execute_enter_subgraph_scenario(context)
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
