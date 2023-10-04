# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import base64
import errno
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional, List
import re
import requests
from urllib.parse import urlparse
import os

import pipeline_manager
from pipeline_manager.specification_reader import \
    minify_specification as minify_spec, retrieve_used_icons  # noqa: E501


def build_singlehtml(
        dist_path: Path,
        single_html_path: Path,
        used_icons: Optional[List]):
    """
    Creates a single, self-contained HTML from the dist directory.

    Parameters
    ----------
    dist_path: Path
        Path to the dist directory with built frontend
    single_html_path: Path
        Path to the output standalone HTML file
    used_icons: Optional[List]
        List of names of used images that are included in the output html.
        If the value is None then all images are included.
    """
    from bs4 import BeautifulSoup

    with open(dist_path / "index.html", "r") as indexfile:
        soup = BeautifulSoup(indexfile.read(), features="html.parser")
    scripts = soup.findAll("script")
    for script in scripts:
        tag = soup.new_tag("script", type="module", defer="defer")
        with open(dist_path / script["src"], "r") as scriptfile:
            tag.string = scriptfile.read()
        script.replaceWith(tag)

    soup = str(soup)

    assets_path = dist_path / "assets"
    for file in assets_path.glob("**/*"):
        if file.is_dir():
            continue
        relative_filename = str(file.relative_to(assets_path))
        if used_icons is None or relative_filename in used_icons:
            if file.suffix == ".svg":
                ctype = "svg+xml"
            elif file.suffix == ".png":
                ctype = "png"
            else:
                # Fallback ctype is the suffix without a dot
                ctype = file.suffix[1:]

            with open(file, "rb") as imgfile:
                imgB64 = base64.b64encode(imgfile.read())
                soup = soup.replace(
                    f"assets/{relative_filename}",
                    f"data:image/{ctype};base64,{imgB64.decode()}",
                )

    with open(single_html_path, "w") as outputfile:
        outputfile.write(soup)


def build_prepare(
        workspace_directory: Optional[Path] = None,
        skip_install_deps: bool = False):
    """
    Prepares the workspace directory for building.

    If the workspace directory is empty, the source files are placed
    in this directory for building the frontend application.


    Parameters
    ----------
    workspace_directory: Path
        Path where the frontend should be built
    skip_install_deps: bool
        Tells whether npm install should be skipped or not

    Returns
    -------
    int :
        0 if successful, other value means error from npm.
    Path:
        path to the workspace directory
    """
    project_path = Path(__file__).parent.parent.absolute()
    frontend_path = project_path / 'pipeline_manager/frontend'
    resources_path = project_path / 'pipeline_manager/resources'

    # change project path to current working directory if project is
    # installed in other location, but we are in the repo directory
    if (Path.cwd() / 'pipeline_manager/frontend').is_dir() \
            and Path(pipeline_manager.__file__).samefile(Path.cwd() / 'pipeline_manager/__init__.py'):  # noqa E501
        project_path = Path.cwd().absolute()
        frontend_path = project_path / 'pipeline_manager/frontend'
        resources_path = project_path / 'pipeline_manager/resources'

    # check if building is happening in repo, if not ask the user to provide
    # the necessary directory paths
    elif not workspace_directory:
        print(
            'The build script requires providing workspace path for storing '
            'frontend sources for building purposes',
            file=sys.stderr
        )
        print(
            'Please provide it --workspace-directory',
            file=sys.stderr
        )
        return errno.EINVAL, workspace_directory

    if workspace_directory:
        workspace_directory.mkdir(parents=True, exist_ok=True)

        if len(list(workspace_directory.glob('*'))) == 0:
            shutil.copytree(
                frontend_path,
                workspace_directory / 'frontend',
                dirs_exist_ok=True)
            shutil.copytree(
                resources_path,
                workspace_directory / 'resources',
                dirs_exist_ok=True)
    else:
        workspace_directory = project_path / 'pipeline_manager'
    frontend_path = workspace_directory / 'frontend'

    if skip_install_deps:
        return 0, workspace_directory
    exit_status = subprocess.run(
        ['npm', 'install'],
        cwd=frontend_path
    )
    return exit_status.returncode, workspace_directory


def build_frontend(
        build_type: str,
        assets_directory: Optional[Path] = None,
        json_url_specification: Optional[Path] = None,
        editor_title: Optional[str] = None,
        specification: Optional[Path] = None,
        dataflow: Optional[Path] = None,
        mode: str = 'production',
        output_directory: Optional[Path] = None,
        workspace_directory: Optional[Path] = None,
        clean_build: bool = False,
        single_html: Optional[Path] = None,
        minify_specification: bool = False,
        graph_development_mode: bool = False,
        skip_install_deps: bool = False):
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
    workspace_directory: Optional[Path]
        Tells where the frontend sources should be stored.
        Is only used when building the project in location different than
        repository root
    clean_build: bool
        Tells if the build directories should be cleaned before building
    single_html: Optional[Path]
        Path, where the standalone HTML (with no additional dependencies)
        should be built
    minify_specification: bool
        Creates a minimal specification for the given dataflow.
        The specification will only contain node types used in
        given dataflow.
    graph_development_mode: bool
        Allows errors in the graph to occur and tries to visualize
        as much of the graph as possible for development/debugging purposes.
    skip_install_deps: bool
        Tells if npm install should be skipped or not

    Returns
    -------
    int: 0 if successfull, EINVAL if arguments are conflicting or invalid
    """

    exit_status, workspace_directory = build_prepare(
        workspace_directory,
        skip_install_deps
    )
    if exit_status != 0:
        return exit_status

    frontend_path = workspace_directory / 'frontend'

    config_path = frontend_path / '.env.static.local' if \
        build_type == 'static-html' else \
        frontend_path / '.env.local'

    frontend_dist_path = (frontend_path / 'dist').resolve()

    config_lines = []

    if specification:
        specification = Path(specification).absolute()
    if dataflow:
        dataflow = Path(dataflow).absolute()

    if editor_title:
        config_lines.append(f'VUE_APP_EDITOR_TITLE={editor_title}\n')

    urls = None
    if json_url_specification:
        json_url_specification = Path(json_url_specification).absolute()
        with open(json_url_specification, 'r') as f:
            urls = json.load(f)

    used_icons = None
    if minify_specification:
        if not (specification and dataflow):
            print(
                "Cannot minify the specification without the dataflow.",
                file=sys.stderr
            )
            return errno.EINVAL
        with open(specification, 'r') as specfile:
            spec = json.load(specfile)
        with open(dataflow, 'r') as dataflowfile:
            dataflowstruct = json.load(dataflowfile)
        newspec = minify_spec(spec, dataflowstruct)
        used_icons = retrieve_used_icons(newspec)
        minified_spec_path = specification.with_suffix('.min.json')
        with open(minified_spec_path, 'w') as minified_spec_file:
            print(f"Writing minimized specification to:  {minified_spec_path}")
            json.dump(newspec, minified_spec_file)
            specification = minified_spec_path

    if single_html:
        config_lines.append('VUE_APP_SINGLEHTML_BUILD=true\n')

    if graph_development_mode:
        config_lines.append('VUE_APP_GRAPH_DEVELOPMENT_MODE=true\n')

    config_lines.append(f'NODE_ENV="{mode}"\n')
    if mode == 'development':
        config_lines.append('VUE_APP_VERBOSE=true\n')

    if urls is not None:
        config_lines.append(
            f'VUE_APP_JSON_URL_SUBSTITUTES="{json.dumps(urls)}"\n'
        )

    if assets_directory:
        shutil.copytree(
            assets_directory,
            frontend_path / 'assets',
            dirs_exist_ok=True
        )

    single_html_spec = None
    if single_html:
        # Preprocessing url assets so that they are accessible offline
        with open(specification, 'r') as specfile:
            spec = json.load(specfile)

        def store_url_asset(filename):
            if re.match(r'^https?:\/\/(www\.)?.*$', filename):
                imgfile = requests.get(filename, timeout=4)
                suffix = imgfile.headers['Content-Type']
                if suffix == 'image/svg+xml':
                    suffix = 'svg'
                else:
                    suffix = suffix.split('/')[1]

                new_filename = urlparse(filename).path.split('/')[-1]
                new_filename = f'{new_filename}.{suffix}'
                with open(frontend_path / 'assets' / new_filename, 'wb+') as f:
                    f.write(imgfile.content)
                return new_filename
            return filename

        # Retrieving all urls of icons
        if "urls" in spec["metadata"]:
            for url in spec["metadata"]["urls"].values():
                filename = url['icon']
                url['icon'] = store_url_asset(filename)

        for node in spec["nodes"]:
            if "icon" in node:
                filename = node['icon']
                node['icon'] = store_url_asset(filename)

        single_html_spec = specification.with_suffix('.tmp.json')
        with open(single_html_spec, 'w') as preprocessed_spec_file:
            json.dump(spec, preprocessed_spec_file)
            specification = single_html_spec

    if specification:
        specification = Path(specification).absolute()
        config_lines.append(f'VUE_APP_SPECIFICATION_PATH={specification}\n')
        if dataflow:
            dataflow = Path(dataflow).absolute()
            config_lines.append(f'VUE_APP_DATAFLOW_PATH={dataflow}\n')

    if config_lines:
        with open(config_path, 'w') as config:
            config.writelines(config_lines)

    if output_directory:
        output_directory = output_directory.resolve()

        if clean_build and Path(output_directory).exists():
            shutil.rmtree(output_directory)
        frontend_dist_path = output_directory

    # Building frontend application
    if build_type == 'static-html':
        exit_status = subprocess.run(
            [
                'npm', 'run', 'build-static-html',
                '--', '--dest', f'{frontend_dist_path}'
            ],
            cwd=frontend_path
        )
        if exit_status.returncode != 0:
            return exit_status.returncode
    if build_type == 'server-app':
        exit_status = subprocess.run(
            [
                'npm', 'run', 'build-server-app',
                '--', '--dest', f'{frontend_dist_path}'
            ],
            cwd=frontend_path
        )
        if exit_status.returncode == errno.EACCES:
            print(
                'The build script requires providing workspace path for '
                'storing frontend sources and a path for the built frontend',
                file=sys.stderr
            )
            print(
                'Please provide them with --workspace-directory and '
                '--output-directory',
                file=sys.stderr
            )
            return exit_status.returncode

        if exit_status.returncode != 0:
            return exit_status.returncode

    if single_html:
        build_singlehtml(frontend_dist_path, single_html, used_icons)
        os.remove(single_html_spec)

    return 0
