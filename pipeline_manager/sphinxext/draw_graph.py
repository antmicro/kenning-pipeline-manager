# Copyright (c) 2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Sphinx extension for drawing graphs using Pipeline Manager.
"""

from __future__ import annotations

from typing import Optional
from urllib.parse import urlencode

from docutils import nodes
from docutils.parsers.rst.directives import path
from sphinx.addnodes import download_reference
from sphinx.application import Sphinx
from sphinx.util.docutils import SphinxDirective
from sphinx.util.typing import ExtensionMetadata
from sphinx.writers.html5 import HTML5Translator
from sphinx.writers.latex import LaTeXTranslator

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
    def visit_latex(trans: LaTeXTranslator, node: KPMNode):
        """
        Node renderer method for LaTeX target.
        """
        node = node.attributes["self_ref"]
        trans.body.append(
            rf"""
\begin{{sphinxadmonition}}{{warning}}{{Note:}}
\sphinxAtStartPar
{node.alt}
\end{{sphinxadmonition}}"""
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
        return [KPMNode(depth=self.env.docname.count("/"), **self.options)]


def build_pipeline_manager(app):
    """
    Builds Pipeline Manager frontend on builder's initialization.
    """
    from sphinx.errors import ExtensionError

    from pipeline_manager.frontend_builder import (
        build_frontend,
        copy_frontend_to_workspace,
    )

    workspace_dir = app.builder.outdir.parent / "pm-workspace"
    static_dir = app.builder.outdir / "_static"

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
        )
        if status != 0:
            raise ExtensionError(
                f"Failed to build frontend for Pipeline Manager in {static_dir} ({status})"  # noqa: E501
            )


def setup(app: Sphinx) -> ExtensionMetadata:
    """
    Method setting up a Pipeline Manager extension.
    """
    app.add_node(
        KPMNode,
        html=(KPMNode.visit_html, KPMNode.depart_node),
        latex=(KPMNode.visit_latex, KPMNode.depart_node),
    )
    app.add_directive("pipeline_manager", KPMDirective)

    app.connect("builder-inited", build_pipeline_manager)

    return {
        "version": "0.1",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }
