# Copyright (c) 2022-2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Provides function for creating FastAPI application.
"""

import logging
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
    frontend_dir: Optional[Path] = None,
    relative_pm_url: Optional[Path] = None,
    follow_symlink: bool = False,
    assets_dir: Optional[Path] = None,
) -> FastAPI:
    """
    Hosts frontend application.

    Parameters
    ----------
    frontend_dir : Optional[Path]
        Path where the built frontend is stored.
    relative_pm_url : Optional[Path]
        Path in URL where Pipeline Manager should be served
    follow_symlink : bool
        Whether StaticFiles should follow symlinks when resolving files
        under frontend_dir. Needed when frontend_dir, or files within it,
        are only reachable through symlinks.
    assets_dir : Optional[Path]
        Path where with additional assets; it will be mounted to /assets.

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
    if assets_dir:
        if not assets_dir.exists():
            raise ValueError(
                f"Provided asset directory: {assets_dir} does not exist."
            )

        frontend_assets_dir = frontend_dir / "assets"
        if (frontend_assets_dir).exists():
            frontend_assets_dir = frontend_assets_dir.resolve()
            logging.log(
                logging.WARNING,
                "Custom asset directory shadows assets "
                f"from frontend directory ({frontend_assets_dir}). "
                "The frontend assets will not be reachable.",
            )

        assets_dir = assets_dir.absolute()
        app.mount(
            "/assets",
            StaticFiles(directory=assets_dir, follow_symlink=follow_symlink),
            name="static",
        )

    app.mount(
        "/",
        StaticFiles(
            directory=frontend_dir, html=True, follow_symlink=follow_symlink
        ),
        name="static",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_headers=["*"],
        allow_methods=["GET"],
        max_age=None,
    )

    return app
