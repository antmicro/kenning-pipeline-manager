# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import base64
import os
import errno
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional, List

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


def build_prepare(frontend_path):

    subprocess.run(['npm', 'install'], cwd=frontend_path)


def build_frontend(
        build_type: str,
        assets_directory: Optional[Path] = None,
        editor_title: Optional[str] = None,
        specification: Optional[Path] = None,
        dataflow: Optional[Path] = None,
        mode: str = 'production',
        output_directory: Optional[Path] = None,
        workspace_directory: Optional[Path] = None,
        clean_build: bool = False,
        single_html: Optional[Path] = None,
        minify_specification: bool = False,
        graph_development_mode: bool = False):
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

    Returns
    -------
    int: 0 if successfull, EINVAL if arguments are conflicting or invalid
    """
    project_path = Path(__file__).parent.parent.absolute()
    frontend_path = project_path / 'pipeline_manager/frontend'
    resources_path = project_path / 'pipeline_manager/resources'

    config_path = frontend_path / '.env.static.local' if \
        build_type == 'static-html' else \
        frontend_path / '.env.local'

    frontend_dist_path = frontend_path / 'dist'

    config_lines = []

    # check if building is happening in repo, if not ask the user to provide
    # the necessary directory paths
    if not os.path.exists(Path(os.getcwd()) / 'pipeline_manager/frontend')\
            and not workspace_directory and not output_directory:

        print(
            'The build script requires providing workspace path for storing '
            'frontend sources and a path for the built frontend',
            file=sys.stderr
        )
        print(
            'Please provide them with --workspace-directory and '
            '--output-directory',
            file=sys.stderr
        )
        return errno.EINVAL

    # change project path to current working directory if project is
    # installed in other location, but we are still in the repo directory
    if os.path.exists(Path(os.getcwd()) / 'pipeline_manager/frontend')\
        and not Path(pipeline_manager.__file__).samefile(Path(os.getcwd()) / 'pipeline_manager/__init__.py'): # noqa E501

        project_path = Path(os.getcwd()).absolute()
        frontend_path = project_path / 'pipeline_manager/frontend'
        frontend_dist_path = frontend_path / 'dist'
        resources_path = project_path / 'pipeline_manager/resources'

    if workspace_directory:

        workspace_directory = Path(os.getcwd() / workspace_directory)

        if clean_build and Path(workspace_directory).exists():
            shutil.rmtree(workspace_directory)

        if not os.path.exists(workspace_directory):
            workspace_directory.mkdir(parents=True)

        shutil.copytree(
            frontend_path,
            workspace_directory / 'frontend',
            dirs_exist_ok=True)
        shutil.copytree(
            resources_path,
            workspace_directory / 'resources',
            dirs_exist_ok=True)

        frontend_path = workspace_directory / 'frontend'
        config_path = workspace_directory / '.env.static.local' if \
            build_type == 'static_html' else \
            workspace_directory / '.env.local'

    build_prepare(frontend_path)

    if specification:
        specification = Path(specification).absolute()
    if dataflow:
        dataflow = Path(dataflow).absolute()

    if editor_title:
        config_lines.append(f'VUE_APP_EDITOR_TITLE={editor_title}\n')

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

    if specification:
        specification = Path(specification).absolute()
        config_lines.append(f'VUE_APP_SPECIFICATION_PATH={specification}\n')
        if dataflow:
            dataflow = Path(dataflow).absolute()
            config_lines.append(f'VUE_APP_DATAFLOW_PATH={dataflow}\n')

    if single_html:
        config_lines.append('VUE_APP_SINGLEHTML_BUILD=true\n')

    if graph_development_mode:
        config_lines.append('VUE_APP_GRAPH_DEVELOPMENT_MODE=true\n')

    config_lines.append(f'NODE_ENV="{mode}"\n')
    if mode == 'development':
        config_lines.append('VUE_APP_VERBOSE=true\n')

    if config_lines:
        with open(config_path, 'w') as config:
            config.writelines(config_lines)

    exit_status = subprocess.run(['npm', 'install'], cwd=frontend_path)
    if exit_status.returncode != 0:
        return exit_status.returncode

    if output_directory:
        output_directory = Path(os.getcwd() / output_directory)

        if clean_build and Path(output_directory).exists():
            shutil.rmtree(output_directory)
        frontend_dist_path = Path(
            os.path.abspath(sys.argv[0])).parent / output_directory

    if assets_directory:
        shutil.copytree(
            assets_directory,
            frontend_path / 'assets',
            dirs_exist_ok=True
        )

    if build_type == 'static-html':
        subprocess.run(['npm', 'run', 'build-static-html', '--', '--dest',
                        f'{frontend_dist_path}'], cwd=frontend_path)
        if exit_status.returncode != 0:
            return exit_status.returncode
    if build_type == 'server-app':
        subprocess.run(['npm', 'run', 'build-server-app', '--', '--dest',
                        f'{frontend_dist_path}'], cwd=frontend_path)
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

    return 0
