# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with tests of mirroring changes between two Pipeline Managers."""

import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import pytest
from playwright.sync_api import Locator, Page, expect, sync_playwright

PROTOCOL = "http"
SERVER_ADDRESS = "127.0.0.1"
ORIGINAL_PORT = 5000
COPY_PORT = 5001
PROCESS_SHUTDOWN_TIME = 5

DATAFLOW_PATH = Path(__file__).parent / "frontend_tester_dataflow.json"
NODE = next(
    node
    for node in json.loads(DATAFLOW_PATH.read_text())["graphs"][0]["nodes"]
    if node["name"] == "RunBehaviour"
)
NODE_ID = NODE["id"]
NODE_POSITION = (f"{NODE['position']['x']}px", f"{NODE['position']['y']}px")


@pytest.fixture
def mirror_server(build_server_app: str):
    """Fixture running both Pipeline Managers and the mirroring application."""
    startup_time = 5
    process = None
    try:
        args = [
            sys.executable,
            "-m",
            "pipeline_manager.frontend_tester.tester_mirror",
            "--frontend-path",
            str(build_server_app),
            "--host",
            SERVER_ADDRESS,
            "--backend-port",
            str(ORIGINAL_PORT),
            "--backend-port-second",
            str(COPY_PORT),
        ]
        process = subprocess.Popen(args, preexec_fn=os.setsid)
        time.sleep(startup_time)
        yield
    except Exception as e:
        pytest.fail(f"Failed to start the mirroring application: {e}")
    finally:
        if process:
            process_group_id = os.getpgid(process.pid)
            os.killpg(process_group_id, signal.SIGTERM)
            time.sleep(PROCESS_SHUTDOWN_TIME)
            os.killpg(process_group_id, signal.SIGKILL)


def open_pipeline_manager(page: Page, port: int):
    """Open Pipeline Manager and wait for the specification from backend."""
    page.goto(f"{PROTOCOL}://{SERVER_ADDRESS}:{port}")
    expect(
        page.locator(".baklava-node-palette").get_by_text("Descriptions")
    ).to_be_attached(timeout=15000)


def upload_dataflow_file(page: Page):
    """Upload the frontend tester dataflow to the frontend."""
    with page.expect_file_chooser() as fc_info:
        page.mouse.move(25, 25)
        page.get_by_text("Load graph file").click()
    fc_info.value.set_files(str(DATAFLOW_PATH))


def get_node(page: Page) -> Locator:
    """Get the tested node."""
    return page.locator(f'[id="{NODE_ID}"]')


def expect_position(node: Locator, position: tuple[str, str]):
    """Check the position of the node on the editor."""
    expect(node).to_have_css("left", position[0])
    expect(node).to_have_css("top", position[1])


def drag_node(page: Page, node: Locator, dx: int, dy: int):
    """Drag the node by its title."""
    box = node.locator(".__title").bounding_box()
    assert box is not None
    x, y = box["x"] + 20, box["y"] + box["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + dx, y + dy)
    page.mouse.up()


def test_node_move_is_mirrored(mirror_server):
    """
    Test if moving a node, and undoing the move, in the original
    Pipeline Manager moves the node in its copy.
    """
    with sync_playwright() as playwright:
        browser = playwright.firefox.launch()
        try:
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080}
            )
            copy = context.new_page()
            open_pipeline_manager(copy, COPY_PORT)
            original = context.new_page()
            open_pipeline_manager(original, ORIGINAL_PORT)

            upload_dataflow_file(original)
            original_node = get_node(original)
            copy_node = get_node(copy)
            expect_position(original_node, NODE_POSITION)
            expect_position(copy_node, NODE_POSITION)

            drag_node(original, original_node, 200, 100)
            expect(original_node).not_to_have_css("left", NODE_POSITION[0])
            moved = (
                original_node.evaluate("(e) => e.style.left"),
                original_node.evaluate("(e) => e.style.top"),
            )
            expect_position(copy_node, moved)

            original.keyboard.press("Control+KeyZ")
            expect_position(original_node, NODE_POSITION)
            expect_position(copy_node, NODE_POSITION)
        finally:
            browser.close()
