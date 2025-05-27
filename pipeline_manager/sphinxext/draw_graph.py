# Copyright (c) 2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Sphinx extension for drawing graphs using Pipeline Manager.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode

from docutils import nodes
from docutils.parsers.rst.directives import path
from sphinx.addnodes import download_reference
from sphinx.application import Sphinx
from sphinx.errors import ExtensionError
from sphinx.util.docutils import SphinxDirective
from sphinx.writers.html5 import HTML5Translator

KPM_PATH = "_static/pipeline-manager.html"
DEFAULT_ALT_TEXT = "An interactive KPM frame, where you can explore the block design for this section, is available here in the HTML version of this documentation."  # noqa: E501


class KPMNode(nodes.container):
    """
    Docutils node introducing Pipeline Manager graph to docs.
    """

    def __init__(
        self,
        *,
        depth: int,
        preview: Optional[bool] = None,
        spec: Optional[str] = None,
        graph: Optional[str] = None,
        height: Optional[str] = None,
        alt: Optional[str] = None,
    ) -> None:
        """Constructor for KPMNode."""
        # we're leveraging the builtin download_reference node
        # to automatically move necessary files from sources
        # into the build directory and have a path to them
        spec_node = graph_node = None
        if spec:
            spec_node = download_reference(
                "", "", reftarget=spec, disabled=True
            )
        if graph:
            graph_node = download_reference(
                "", "", reftarget=graph, disabled=True
            )

        super().__init__(
            "",
            *(node for node in (spec_node, graph_node) if node),
            self_ref=self,
        )
        self.spec_node = spec_node
        self.graph_node = graph_node
        self.rel_pfx = "../" * depth
        self.preview = preview
        self.height = height
        self.alt = alt if alt is not None else DEFAULT_ALT_TEXT

    def _node_to_target(self, node: download_reference) -> str:
        if "filename" in node:
            return "relative://../_downloads/" + node["filename"]
        elif "refuri" in node:
            return node["refuri"]

        raise ValueError("The KPM file path is neither a valid file nor a URL")

    @staticmethod
    def visit_html(trans: HTML5Translator, node: KPMNode):
        """
        Node renderer method for HTML target.
        """
        params = {}
        if node.spec_node:
            params["spec"] = node._node_to_target(node.spec_node)
        if node.graph_node:
            params["graph"] = node._node_to_target(node.graph_node)
        if node.preview:
            params["preview"] = str(node.preview).lower()

        trans.body.append(
            f"""
<iframe src='{node.rel_pfx}{KPM_PATH}?{urlencode(params)}'
    allow='fullscreen'
        style='
            width:100%;
            {"height:" + node.height if node.height else "aspect-ratio:3/2"};
            border:none;
        '
></iframe>"""
        )

    @staticmethod
    def depart_node(*_):
        pass


class KPMDirective(SphinxDirective):
    """
    Sphinx directive for pipeline_manager.
    """

    option_spec = {
        "spec": path,
        "graph": path,
        "preview": bool,
        "height": str,
        "alt": str,
    }

    def run(self) -> list[nodes.Node]:
        """
        Creates nodes for the directive.
        """
        if self.env.app.builder.name in ["html", "linkcheck"]:
            return [KPMNode(depth=self.env.docname.count("/"), **self.options)]

        try:
            from html2image import Html2Image
        except ImportError:
            raise ExtensionError(
                "html2image module is missing for converting HTML graphs to images, please install it."  # noqa: E501
            )
        from tempfile import NamedTemporaryFile

        from pipeline_manager.frontend_builder import build_frontend

        workspace_dir = (
            Path(self.env.app.builder.outdir).parent / "pm-workspace"
        )
        pm_graphs_dir = Path(self.env.app.builder.outdir) / "_static/pm-graphs"

        pm_graphs_dir.mkdir(parents=True, exist_ok=True)

        curr_file_path = Path(self.env.doc2path(self.env.docname)).resolve()
        out_html = (workspace_dir / "frontend/dist/index.html").resolve()
        spec_path = (
            curr_file_path.parent / self.options["spec"]
            if "spec" in self.options
            else None
        )
        graph_path = (
            curr_file_path.parent / self.options["graph"]
            if "graph" in self.options
            else None
        )
        status = build_frontend(
            build_type="static-html",
            specification=spec_path,
            dataflow=graph_path,
            workspace_directory=workspace_dir,
            skip_install_deps=True,
            skip_frontend_copying=True,
        )
        if status != 0:
            raise ExtensionError(
                f"Failed to build frontend for Pipeline Manager in ({status})"
            )
        hti = Html2Image(
            size=(1920, 1080),
            custom_flags=[
                "--virtual-time-budget=10000",
                "--hide-scrollbars",
                "--disable-gpu",
                "--no-sandbox",
            ],
            output_path=pm_graphs_dir,
        )
        hti.browser.use_new_headless = True
        with NamedTemporaryFile(
            prefix="pipeline-manager-",
            suffix=".png",
            delete=False,
            dir=pm_graphs_dir,
        ) as f:
            graph_path = Path(f.name).resolve()
        hti.screenshot(
            url=f"file://{out_html}?preview=true",
            save_as=str(graph_path.relative_to(pm_graphs_dir)),
        )
        uri = os.path.relpath(graph_path, curr_file_path.parent)
        return [nodes.image(uri=uri, alt="Graph")]


def build_pipeline_manager(app):
    """
    Builds Pipeline Manager frontend on builder's initialization.
    """
    from pipeline_manager.frontend_builder import (
        build_frontend,
        copy_frontend_to_workspace,
    )

    assets_dir = None
    if app.config.pipeline_manager_assets_directory:
        assets_dir = Path(app.config.pipeline_manager_assets_directory)
    workspace_dir = Path(app.builder.outdir).parent / "pm-workspace"
    static_dir = Path(app.builder.outdir) / "_static"

    static_dir.mkdir(parents=True, exist_ok=True)

    frontend_changed = True
    if workspace_dir.exists():
        frontend_changed = copy_frontend_to_workspace(
            workspace_directory=workspace_dir,
        )

    if frontend_changed:
        status = build_frontend(
            build_type="static-html",
            workspace_directory=workspace_dir,
            single_html=static_dir / "pipeline-manager.html",
            assets_directory=assets_dir,
        )
        if status != 0:
            raise ExtensionError(
                f"Failed to build frontend for Pipeline Manager in {static_dir} ({status})"  # noqa: E501
            )


def setup(app: Sphinx):
    """
    Method setting up a Pipeline Manager extension.
    """
    app.add_config_value(
        name="pipeline_manager_assets_directory", default="", rebuild="env"
    )
    app.add_node(
        KPMNode,
        html=(KPMNode.visit_html, KPMNode.depart_node),
    )
    app.add_directive("pipeline_manager", KPMDirective)

    app.connect("builder-inited", build_pipeline_manager)

    return {
        "version": "0.1",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }
