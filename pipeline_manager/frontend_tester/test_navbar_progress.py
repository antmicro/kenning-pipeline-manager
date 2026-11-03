# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module with tests of navbar buttons progress."""

import re
import subprocess
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

PROTOCOL = "http"
SERVER_ADDRESS = "127.0.0.1"
SERVER_PORT = 5000
PROCESS_SHUTDOWN_TIME = 5
CLIENTS_DIRECTORY = Path(__file__).parent / "clients"


def test_navbar_progress(rpc_server):
    """
    Test if `progress_change` updates the progress bar of a running
    procedure and if buttons that cannot run in parallel with it are
    grayed out until it finishes.
    """
    args = [
        "python3",
        str(CLIENTS_DIRECTORY / "navbar_progress_client.py"),
    ]
    client_process = subprocess.Popen(args)
    try:
        with sync_playwright() as playwright:
            browser = playwright.firefox.launch()
            page = browser.new_page()
            page.goto(f"{PROTOCOL}://{SERVER_ADDRESS}:{SERVER_PORT}")

            long_task = page.locator("#navbar-button-custom_long_task")
            blocked_task = page.locator("#navbar-button-custom_blocked_task")
            release = page.locator("#navbar-button-custom_release")
            progress_bar = long_task.locator(".progress-bar")

            long_task.click()

            expect(long_task).to_have_class(re.compile("button-in-progress"))
            expect(progress_bar).to_have_attribute(
                "style", re.compile(r"width:\s*50%")
            )
            expect(blocked_task).to_have_class(re.compile("button-disabled"))
            expect(release).not_to_have_class(re.compile("button-disabled"))

            release.click()

            expect(long_task).not_to_have_class(
                re.compile("button-in-progress")
            )
            expect(progress_bar).to_have_attribute(
                "style", re.compile(r"width:\s*0%")
            )
            expect(blocked_task).not_to_have_class(
                re.compile("button-disabled")
            )

            browser.close()
    finally:
        client_process.terminate()
        time.sleep(PROCESS_SHUTDOWN_TIME)
        client_process.kill()
