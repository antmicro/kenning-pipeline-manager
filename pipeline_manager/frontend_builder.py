# Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Provides methods for building Pipeline Manager's frontend.
"""

import base64
import errno
import filecmp
import json
import logging
import os
import re
import shutil
import subprocess
from importlib import resources as importlib_resources
from pathlib import Path
from typing import List, Optional, Tuple

import requests

import pipeline_manager
from pipeline_manager import resources
from pipeline_manager.specification_reader import (
    minify_specification as minify_spec,  # noqa: E501
)
from pipeline_manager.specification_reader import retrieve_used_icons


def build_singlehtml(
    dist_path: Path, single_html_path: Path, used_icons: Optional[List]
):
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


def get_project_paths() -> Tuple[str, str, str]:
    """
    Returns project-specific paths.

    It can point either to Pipeline Manager module, or
    to current directory, if it is a Pipeline Manager
    repository, based on directory layout.

    Returns
    -------
    str
        Path to Pipeline Manager project in the system
    str
        Path to frontend for Pipeline Manager
    str
        Path to resources for Pipeline Manager
    """
    project_path = Path(__file__).parent.parent.absolute()
    frontend_path = project_path / "pipeline_manager/frontend"
    resources_path = project_path / "pipeline_manager/resources"

    # change project path to current working directory if project is
    # installed in other location, but we are in the repo directory
    if (Path.cwd() / "pipeline_manager/frontend").is_dir() and Path(
        pipeline_manager.__file__
    ).samefile(Path.cwd() / "pipeline_manager/__init__.py"):  # noqa E501
        project_path = Path.cwd().absolute()
        frontend_path = project_path / "pipeline_manager/frontend"
        resources_path = project_path / "pipeline_manager/resources"

    return project_path, frontend_path, resources_path


def copy_frontend_to_workspace(
    workspace_directory: Path, dont_update: bool = False
) -> bool:
    """
    Copies frontend and resources files to the workspace directory.

    If workspace_directory does not exist, it is created.

    Method returns boolean telling whether any changes were made in
    the source files compared to workspace directory (True) or not
    (False).

    Parameters
    ----------
    workspace_directory: Path
        Path to the workspace directory
    dont_update: bool
        Tells not to update files in the workspace directory if they differ
        from module's frontend files

    Returns
    -------
    bool
        True if any file was copied (new or changed), False if workspace
        directory is already up to date.
    """
    project_path, frontend_path, resources_path = get_project_paths()

    workspace_directory.mkdir(parents=True, exist_ok=True)

    if (len_work := len(list(workspace_directory.glob("*")))) == 0:
        shutil.copytree(
            frontend_path,
            workspace_directory / "frontend",
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns("node_modules"),
        )
        shutil.copytree(
            resources_path,
            workspace_directory / "resources",
            dirs_exist_ok=True,
        )
        return True
    elif len_work > 0 and not dont_update:

        def _check_subdir(diff: filecmp.dircmp, current_path: Path):
            changed = False
            # if those files aren't ignored,
            # the sync will always trigger since
            # the time signature of the file changes
            ignored_files = [
                ".env.local",
                ".env.static.local",
                "node_modules",
            ]
            changed_sources = list(
                filter(lambda x: x not in ignored_files, diff.diff_files)
            )
            for i in changed_sources:
                src = frontend_path / current_path / i
                dst = workspace_directory / "frontend" / current_path / i
                shutil.copy(src, dst)
                changed |= True
            if diff.subdirs is not {}:
                for name, subdir in diff.subdirs.items():
                    if name not in ignored_files:
                        changed |= _check_subdir(subdir, current_path / name)
            return changed

        root_diff = filecmp.dircmp(
            workspace_directory / "frontend", frontend_path
        )
        return _check_subdir(root_diff, Path(""))
    else:
        return False


def build_prepare(
    workspace_directory: Optional[Path] = None,
    skip_install_deps: bool = False,
    skip_frontend_copying: bool = False,
) -> Tuple[int, Path]:
    """
    Prepares the workspace directory for building.

    If the workspace directory is empty, the source files are placed
    in this directory for building the frontend application.


    Parameters
    ----------
    workspace_directory: Optional[Path]
        Path where the frontend should be built
    skip_install_deps: bool
        Tells whether npm install should be skipped or not
    skip_frontend_copying: bool
        Skips the diffing of the frontend directory allowing for changes
        in the workspace directory.

    Returns
    -------
    int
        0 if successful, other value means error from npm.
    Path
        path to the workspace directory
    """
    project_path, frontend_path, _ = get_project_paths()

    # change project path to current working directory if project is
    # installed in other location, but we are in the repo directory
    if not (
        (
            (Path.cwd() / "pipeline_manager/frontend").is_dir()
            and Path(pipeline_manager.__file__).samefile(
                Path.cwd() / "pipeline_manager/__init__.py"
            )
        )
        or workspace_directory
    ):  # noqa E501
        logging.error(
            "The build script requires providing workspace path for storing "
            "frontend sources for building purposes"
        )
        logging.error("Please provide it --workspace-directory")
        return errno.EINVAL, workspace_directory

    if workspace_directory:
        copy_frontend_to_workspace(
            workspace_directory=workspace_directory,
            dont_update=skip_frontend_copying,
        )
    else:
        workspace_directory = project_path / "pipeline_manager"
    frontend_path = workspace_directory / "frontend"

    if skip_install_deps:
        return 0, workspace_directory
    exit_status = subprocess.run(["npm", "install"], cwd=frontend_path)
    return exit_status.returncode, workspace_directory


def build_frontend(
    build_type: str,
    assets_directory: Optional[Path] = None,
    json_url_specification: Optional[Path] = None,
    editor_title: Optional[str] = None,
    specification: Optional[Path] = None,
    dataflow: Optional[Path] = None,
    mode: str = "production",
    output_directory: Optional[Path] = None,
    workspace_directory: Optional[Path] = None,
    clean_build: bool = False,
    single_html: Optional[Path] = None,
    minify_specification: bool = False,
    graph_development_mode: bool = False,
    skip_install_deps: bool = False,
    skip_frontend_copying: bool = False,
    favicon_path: Optional[Path] = None,
    communication_server_host: Optional[str] = None,
    communication_server_port: Optional[int] = None,
) -> int:
    """
    Builds the frontend for the Pipeline Manager.

    Parameters
    ----------
    build_type: str
        Can be either static-html (for standalone webpage) or server-app
        (for server-based application)
    assets_directory: Optional[Path]
        Path to the directory with additional static files, i.e. icons
    json_url_specification: Optional[Path]
        Path to JSON with specification of URI schemes for the frontend.
    editor_title: Optional[str]
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
    skip_frontend_copying: bool
        Skips the diffing of the frontend directory allowing for changes
        in the workspace directory.
    favicon_path: Optional[Path]
        Path to the Kenning Pipeline Manager favicon in SVG format.
        If None, a default favicon is used.
    communication_server_host: Optional[str]
        Hostname of the communication server. Should be used if the
        frontend application is server on different HTTP server than
        the communication server.
    communication_server_port: Optional[int]
        Port of the communication server. Should be used if the
        frontend application is server on different HTTP server than
        the communication server.

    Returns
    -------
    int
        0 if successful, EINVAL if arguments are conflicting or invalid
    """
    exit_status, workspace_directory = build_prepare(
        workspace_directory, skip_install_deps, skip_frontend_copying
    )
    if exit_status != 0:
        return exit_status

    frontend_path = workspace_directory / "frontend"

    config_path = (
        frontend_path / ".env.static.local"
        if build_type == "static-html"
        else frontend_path / ".env.local"
    )

    frontend_dist_path = (frontend_path / "dist").resolve()

    config_lines = []

    if specification:
        specification = Path(specification).absolute()
    if dataflow:
        dataflow = Path(dataflow).absolute()

    if editor_title is not None:
        config_lines.append(f"VUE_APP_EDITOR_TITLE={editor_title}\n")

    urls = None
    if json_url_specification:
        json_url_specification = Path(json_url_specification).absolute()
        with open(json_url_specification, "r") as f:
            urls = json.load(f)

    used_icons = None
    if minify_specification:
        if not (specification and dataflow):
            logging.error(
                "Cannot minify the specification without the dataflow."
            )
            return errno.EINVAL
        with open(specification, "r") as specfile:
            spec = json.load(specfile)
        with open(dataflow, "r") as dataflowfile:
            dataflowstruct = json.load(dataflowfile)
        newspec = minify_spec(spec, dataflowstruct)
        used_icons = retrieve_used_icons(newspec)
        minified_spec_path = specification.with_suffix(".min.json")
        with open(minified_spec_path, "w") as minified_spec_file:
            logging.info(
                f"Writing minimized specification to:  {minified_spec_path}"
            )
            json.dump(newspec, minified_spec_file)
            specification = minified_spec_path

    if single_html:
        config_lines.append("VUE_APP_SINGLEHTML_BUILD=true\n")

    if graph_development_mode:
        config_lines.append("VUE_APP_GRAPH_DEVELOPMENT_MODE=true\n")

    if communication_server_host and communication_server_port:
        config_lines.append(
            f"VUE_APP_COMMUNICATION_SERVER_HOST={communication_server_host}\n"
        )
        config_lines.append(
            f"VUE_APP_COMMUNICATION_SERVER_PORT={communication_server_port}\n"
        )

    config_lines.append(f'NODE_ENV="{mode}"\n')
    if mode == "development":
        config_lines.append("VUE_APP_VERBOSE=true\n")

    if urls is not None:
        config_lines.append(
            f'VUE_APP_JSON_URL_SUBSTITUTES="{json.dumps(urls)}"\n'
        )

    if assets_directory:
        shutil.copytree(
            assets_directory, frontend_path / "assets", dirs_exist_ok=True
        )

    if favicon_path is None:
        favicon_path = importlib_resources.files(resources) / "favicon.svg"
    elif favicon_path.suffix != ".svg":
        logging.error(
            f"Only .svg format is supported for favicon, currently provided file:  {favicon_path}"  # noqa: E501
        )
        return errno.EINVAL

    single_html_spec = None
    if single_html and specification:
        # Preprocessing url assets so that they are accessible offline
        with open(specification, "r") as specfile:
            spec = json.load(specfile)

        filename_to_hash = {}
        hash_counter = 0

        def store_url_asset(filename: str) -> str:
            if re.match(r"^https?:\/\/(www\.)?.*$", filename):
                nonlocal hash_counter
                nonlocal filename_to_hash

                imgfile = requests.get(filename, timeout=4)

                # If Content-Type is not present in the headers
                # then the suffix is deduced from the filename
                try:
                    suffix = imgfile.headers["Content-Type"]
                    if suffix == "image/svg+xml":
                        suffix = "svg"
                    else:
                        suffix = suffix.split("/")[1]
                except KeyError:
                    suffix = filename.split(".")[-1]

                # Extracted filename from url has to include the whole
                # path, as otherwise it would be impossible to distinguish
                # between different files with the same name coming from
                # different directories
                # Using the hash so that the filenames are not too long
                if filename in filename_to_hash:
                    hash = filename_to_hash[filename]
                else:
                    hash = f"{hash_counter}.{suffix}"
                    filename_to_hash[filename] = hash
                    hash_counter += 1

                with open(frontend_path / "assets" / hash, "wb+") as f:
                    f.write(imgfile.content)
                return hash
            return filename

        # Retrieving all urls of icons
        if "metadata" in spec and "urls" in spec["metadata"]:
            for url in spec["metadata"]["urls"].values():
                filename = url["icon"]
                url["icon"] = store_url_asset(filename)

        for node in spec["nodes"]:
            if "icon" in node:
                Path(frontend_path / "assets").mkdir(
                    parents=True, exist_ok=True
                )
                if isinstance(node["icon"], str):
                    filename = node["icon"]
                    node["icon"] = store_url_asset(filename)
                else:
                    icongroup, iconsuffix = list(node["icon"].items())[0]
                    iconprefix = spec["metadata"]["icons"][icongroup]
                    if iconprefix[-1] != "/":
                        iconprefix += "/"
                    if iconsuffix[0] == "/":
                        iconsuffix = iconsuffix[1:]
                    filename = iconprefix + iconsuffix
                    node["icon"] = store_url_asset(filename)

        single_html_spec = specification.with_suffix(".tmp.json")
        with open(single_html_spec, "w") as preprocessed_spec_file:
            json.dump(spec, preprocessed_spec_file)
            specification = single_html_spec

    if specification:
        specification = Path(specification).absolute()
        config_lines.append(f"VUE_APP_SPECIFICATION_PATH={specification}\n")
        if dataflow:
            dataflow = Path(dataflow).absolute()
            config_lines.append(f"VUE_APP_DATAFLOW_PATH={dataflow}\n")

    if config_lines:
        with open(config_path, "w") as config:
            config.writelines(config_lines)

    if output_directory:
        output_directory = output_directory.resolve()

        if clean_build and Path(output_directory).exists():
            shutil.rmtree(output_directory)
        frontend_dist_path = output_directory

    # Building frontend application
    if build_type == "static-html":
        exit_status = subprocess.run(
            [
                "npm",
                "run",
                "build-static-html",
                "--",
                "--dest",
                f"{frontend_dist_path}",
            ],
            cwd=frontend_path,
        )
        if exit_status.returncode != 0:
            return exit_status.returncode
    if build_type == "server-app":
        exit_status = subprocess.run(
            [
                "npm",
                "run",
                "build-server-app",
                "--",
                "--dest",
                f"{frontend_dist_path}",
            ],
            cwd=frontend_path,
        )
        if exit_status.returncode == errno.EACCES:
            logging.error(
                "The build script requires providing workspace path for "
                "storing frontend sources and a path for the built frontend"
            )
            logging.error(
                "Please provide them with --workspace-directory and "
                "--output-directory"
            )
            return exit_status.returncode

        if exit_status.returncode != 0:
            return exit_status.returncode

    shutil.copy(favicon_path, frontend_dist_path / "favicon.svg")

    if single_html:
        build_singlehtml(frontend_dist_path, single_html, used_icons)
        if single_html_spec and single_html_spec.exists():
            os.remove(single_html_spec)

    return 0
