"""Module with tests of subgraph switching."""

import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import pytest
from playwright.sync_api import BrowserContext, Page, expect, sync_playwright

PROTOCOL = "http"
SERVER_ADDRESS = "127.0.0.1"
PROCESS_SHUTDOWN_TIME = 5
CLIENTS_DIRECTORY = Path(__file__).parent / "clients"
EXAMPLES_DIRECTORY = Path(__file__).parents[2] / "examples"


def upload_dataflow_file(
    page: Page,
):
    """Upload either a JSON dataflow file to the frontend."""
    with page.expect_file_chooser() as fc_info:
        page.mouse.move(25, 25)
        text = "Load graph file"
        page.get_by_text(text).click()

    file_chooser = fc_info.value
    file_path = EXAMPLES_DIRECTORY / "sample-subgraph-dataflow.json"
    file_chooser.set_files(str(file_path))


def enter_subgraph_node(page: Page):
    """Navigate to a subgraph node."""
    node = page.locator(
        ".node-container .baklava-node[data-node-type='Test subgraph #1'] ",
    ).nth(0)
    node.locator(".__title").click(button="right")
    contextMenuOption = page.locator(
        ".baklava-editor > .baklava-context-menu"
    ).get_by_text("Go to graph")
    contextMenuOption.click()


def execute_enter_subgraph_scenario(context: BrowserContext, port: int):
    """
    Execute a Playwright scenario, when an agents enters a subgraph,
    utilizing the frontend.

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
    upload_dataflow_file(page)

    nodes = page.locator(".node-container > div")
    expect(nodes).to_have_count(4)

    enter_subgraph_node(page)

    expect(nodes).to_have_count(2)


@pytest.mark.flaky(retries=3, delay=1)
def test_subgraph_switching(
    request: pytest.FixtureRequest,
    rpc_server,
    backend_port: int,
    tcp_server_port: int,
):
    """
    Test if switching to a subgraph while utilizing RPC communication
    works.
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

    try:
        client_process = subprocess.Popen(args)
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
                execute_enter_subgraph_scenario(context, backend_port)
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
