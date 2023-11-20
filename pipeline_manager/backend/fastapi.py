# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from pathlib import Path
from typing import Optional

from pipeline_manager import frontend

dist_path = Path(os.path.dirname(frontend.__file__)) / "dist"


def create_app(frontend_dir: Optional[Path] = None):

    app = FastAPI(title="Pipeline Manager")

    if not frontend_dir:
        frontend_dir = dist_path
    app.mount(
        "/",
        StaticFiles(directory=frontend_dir, html=True),
        name="static"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_headers=["*"],
        allow_methods=["GET"],
        max_age=None,
    )

    return app
