# Copyright (c) 2022-2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Provides function for creating FastAPI application.
"""

import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from pipeline_manager import frontend, prebuilt_frontend


def get_default_frontend_path() -> Path:
    """
    Returns the path to the default, built frontend directory.

    Prefers a frontend built directly in the repository
    (``pipeline_manager/frontend/dist``, e.g. produced by running
    ``./build server-app`` locally), falling back to the frontend
    prebuilt in server mode and bundled with the package
    (``pipeline_manager.prebuilt_frontend``).

    Returns
    -------
    Path
        Path to the default, built frontend directory.
    """
    frontend_dist_path = Path(frontend.__file__).parent / "dist"
    if frontend_dist_path.is_dir():
        return frontend_dist_path
    return Path(prebuilt_frontend.__file__).parent / "dist"


def create_app(
    frontend_dir: Optional[Path] = None, relative_pm_url: Optional[Path] = None
) -> FastAPI:
    """
    Hosts frontend application.

    Parameters
    ----------
    frontend_dir : Optional[Path]
        Path where the built frontend is stored.
    relative_pm_url : Optional[Path]
        Path in URL where Pipeline Manager should be served

    Returns
    -------
    FastAPI
        FastAPI instance

    Raises
    ------
    ValueError
        Raised when relative_pm_url is provided
        but frontend_path is None.
    """
    app = FastAPI(title="Pipeline Manager")

    if not frontend_dir:
        frontend_dir = get_default_frontend_path()
    elif relative_pm_url:
        if frontend_dir is None:
            raise ValueError(
                "When relative_pm_url parameter is provided, frontend_dir needs to be specified."  # noqa: E501
            )
        if relative_pm_url.is_relative_to("/"):
            relative_pm_url = relative_pm_url.relative_to("/")

        shutil.copytree(
            get_default_frontend_path(),
            frontend_dir / relative_pm_url,
            dirs_exist_ok=True,
        )
    app.mount(
        "/", StaticFiles(directory=frontend_dir, html=True), name="static"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_headers=["*"],
        allow_methods=["GET"],
        max_age=None,
    )

    return app
