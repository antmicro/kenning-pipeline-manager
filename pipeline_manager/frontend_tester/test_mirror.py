# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with tests of mirroring changes between two Pipeline Managers."""

import json
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import pytest
from playwright.sync_api import Locator, Page, expect, sync_playwright

from pipeline_manager.utils.ports import get_free_port

PROTOCOL = "http"
SERVER_ADDRESS = "127.0.0.1"
PROCESS_SHUTDOWN_TIME = 5
# Loading the dataflow and mirroring it to the copy can be slow under load
DATAFLOW_LOAD_TIMEOUT = 15000

DATAFLOW_PATH = Path(__file__).parent / "frontend_tester_dataflow.json"
NODE = next(
    node
    for node in json.loads(DATAFLOW_PATH.read_text())["graphs"][0]["nodes"]
    if node["name"] == "RunBehaviour"
)
NODE_ID = NODE["id"]
NODE_POSITION = (f"{NODE['position']['x']}px", f"{NODE['position']['y']}px")


@pytest.fixture
def mirror_ports(backend_port: int) -> tuple[int, int]:
    """Backend ports of the original Pipeline Manager and its copy."""
    return backend_port, get_free_port(SERVER_ADDRESS)


@pytest.fixture
def mirror_server(
    build_server_app: str,
    mirror_ports: tuple[int, int],
    tcp_server_port: int,
):
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
            str(mirror_ports[0]),
            "--backend-port-second",
            str(mirror_ports[1]),
            "--port",
            str(tcp_server_port),
            "--port-second",
            str(get_free_port(SERVER_ADDRESS)),
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


@pytest.fixture
def mirrored_pages(mirror_server, mirror_ports: tuple[int, int]):
    """
    Fixture providing the original Pipeline Manager and its copy,
    both with the dataflow loaded.
    """
    with sync_playwright() as playwright:
        browser = playwright.firefox.launch()
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        copy = context.new_page()
        open_pipeline_manager(copy, mirror_ports[1])
        original = context.new_page()
        open_pipeline_manager(original, mirror_ports[0])

        upload_dataflow_file(original)
        expect_position(
            get_node(original), NODE_POSITION, timeout=DATAFLOW_LOAD_TIMEOUT
        )
        expect_position(
            get_node(copy), NODE_POSITION, timeout=DATAFLOW_LOAD_TIMEOUT
        )
        yield original, copy


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


def expect_position(
    node: Locator,
    position: tuple[str, str],
    timeout: Optional[float] = None,
):
    """Check the position of the node on the editor."""
    expect(node).to_have_css("left", position[0], timeout=timeout)
    expect(node).to_have_css("top", position[1], timeout=timeout)


def drag_node(page: Page, node: Locator, dx: int, dy: int):
    """Drag the node by its title."""
    box = node.locator(".__title").bounding_box()
    assert box is not None
    x, y = box["x"] + 20, box["y"] + box["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + dx, y + dy)
    page.mouse.up()


def test_node_move_is_mirrored(mirrored_pages: tuple[Page, Page]):
    """
    Test if moving a node, and undoing the move, in the original
    Pipeline Manager moves the node in its copy.
    """
    original, copy = mirrored_pages
    original_node = get_node(original)
    copy_node = get_node(copy)

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


def test_select_change_is_mirrored(mirrored_pages: tuple[Page, Page]):
    """
    Test if choosing a value from a dropdown in the original
    Pipeline Manager changes the value in its copy.
    """
    original, copy = mirrored_pages
    original_select = get_node(original).locator(
        '.baklava-select[title="MessageType"]'
    )
    copy_select = get_node(copy).locator(
        '.baklava-select[title="MessageType"]'
    )
    expect(copy_select.locator(".__selected")).to_have_text("OK")

    original_select.click()
    original_select.locator(".__dropdown .item").get_by_text(
        "ERROR", exact=True
    ).click()

    expect(original_select.locator(".__selected")).to_have_text("ERROR")
    expect(copy_select.locator(".__selected")).to_have_text("ERROR")


def test_checkbox_change_is_mirrored(mirrored_pages: tuple[Page, Page]):
    """
    Test if ticking a checkbox in the original Pipeline Manager
    ticks it in its copy.
    """
    original, copy = mirrored_pages
    original_checkbox = get_node(original).locator(
        '.baklava-checkbox[title="Disconnect"]'
    )
    copy_checkbox = get_node(copy).locator(
        '.baklava-checkbox[title="Disconnect"]'
    )
    checked = re.compile(r"(^|\s)--checked(\s|$)")
    expect(copy_checkbox).not_to_have_class(checked)

    original_checkbox.click()

    expect(original_checkbox).to_have_class(checked)
    expect(copy_checkbox).to_have_class(checked)
