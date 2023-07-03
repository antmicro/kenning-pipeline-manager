# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
import subprocess
import shutil
from typing import Optional


def build_prepare():
    projectpath = Path(__file__).parent.parent.absolute()
    frontend_path = projectpath / 'pipeline_manager/frontend'
    subprocess.run(['npm', 'install'], cwd=frontend_path)


def build_frontend(
        build_type: str,
        assets_directory: Optional[Path] = None,
        editor_title: Optional[str] = None,
        specification: Optional[Path] = None,
        dataflow: Optional[Path] = None,
        mode: str = 'production',
        output_directory: Optional[Path] = None,
        clean_build: bool = False):
    """
    Builds the frontend for the Pipeline Manager.

    Parameters
    ----------
    build_type: str
        Can be either static-html (for standalone webpage) or server-app
        (for server-based application)
    assets_directory: Optional[Path]
        Path to the directory with additional static files, i.e. icons
    editor_title: str
        Title of the built page and editor
    specification: Optional[Path]
        Path to the specification file
    dataflow: Optional[Path]
        Path to the dataflow file
    mode: str
        Mode of the npm build (production by default)
    output_directory: Optional[Path]
        Tells where the built frontend should be stored.
        By default it is pipeline_manager/frontend/dist
    clean_build: bool
        Tells if the build directories should be cleaned before building
    """
    projectpath = Path(__file__).parent.parent.absolute()
    frontend_path = projectpath / 'pipeline_manager/frontend'

    config_path = frontend_path / '.env.local'

    config_lines = []

    if editor_title:
        config_lines.append(f'VUE_APP_EDITOR_TITLE={editor_title}\n')

    if build_type == 'static-html' and specification:
        config_path = frontend_path / '.env.static.local'
        specification = Path(specification).absolute()
        config_lines.append(f'VUE_APP_SPECIFICATION_PATH={specification}\n')
        if dataflow:
            dataflow = Path(dataflow).absolute()
            config_lines.append(f'VUE_APP_DATAFLOW_PATH={dataflow}\n')

    config_lines.append(f'NODE_ENV="{mode}"\n')

    if config_lines:
        with open(config_path, 'w') as config:
            config.writelines(config_lines)

    subprocess.run(['npm', 'install'], cwd=frontend_path)

    if build_type == 'static-html':
        subprocess.run(['npm', 'run', 'build-static-html'], cwd=frontend_path)
    if build_type == 'server-app':
        subprocess.run(['npm', 'run', 'build-server-app'], cwd=frontend_path)

    if assets_directory:
        shutil.copytree(
            assets_directory,
            frontend_path / 'dist/assets',
            dirs_exist_ok=True
        )

    if output_directory:
        if clean_build and Path(output_directory).exists():
            shutil.rmtree(output_directory)
        shutil.copytree(
            frontend_path / 'dist',
            output_directory,
            dirs_exist_ok=True
        )
