# Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Configuration for docs building.
"""

import json
from datetime import datetime
from pathlib import Path

from antmicro_sphinx_utils.defaults import antmicro_html, antmicro_latex
from antmicro_sphinx_utils.defaults import extensions as default_extensions
from antmicro_sphinx_utils.defaults import (
    myst_enable_extensions as default_myst_enable_extensions,
)
from antmicro_sphinx_utils.defaults import (
    myst_fence_as_directive as default_myst_fence_as_directive,
)
from antmicro_sphinx_utils.defaults import (
    numfig_format as default_numfig_format,
)
from sphinxcontrib import mermaid

from pipeline_manager.utils.sphinx_jsonschema_spec import generate_schema_md

_original_figure_wrapper = mermaid.figure_wrapper


def figure_wrapper(directive, node, caption):
    """
    Figure wrapper ensuring that width of Mermaid diagrams is not constrained.
    """
    figure = _original_figure_wrapper(directive, node, caption)
    figure["width"] = "auto"
    return figure


mermaid.figure_wrapper = figure_wrapper

# -- General configuration ----------------------------------------------------

# General information about the project.
project = "Pipeline Manager"
basic_filename = "pipeline-manager"
authors = "Antmicro"
copyright = f"{authors}, {datetime.now().year}"

sphinx_immaterial_override_builtin_admonitions = False

numfig = True
numfig_format = default_numfig_format

myst_heading_anchors = 6


# If you need to add extensions just add to those lists
extensions = list(
    set(
        default_extensions
        + ["sphinx.ext.napoleon", "pipeline_manager.sphinxext.draw_graph"]
    )
)  # noqa: E501
myst_enable_extensions = default_myst_enable_extensions
myst_fence_as_directive = default_myst_fence_as_directive

myst_substitutions = {
    "project": project,
    "api_specification": generate_schema_md(),
}

exampleentries = [
    "To see the work of the frontend check one of the below examples:\n"
]  # noqa: E501
for graph in sorted(Path("../../examples").glob("*-dataflow.json")):
    graphname = graph.stem.replace("-dataflow", "")
    spec = graph.parent / f"{graphname}-specification.json"
    title = graph.stem.replace("-dataflow", "")
    with open(graph, "r") as f:
        try:
            data = json.load(f)
            graph_data = data["graphs"][0]
            if "entryGraph" in data:
                entrygraph = data["entryGraph"]
                for graph_data in data["graphs"]:
                    if graph_data["id"] == entrygraph:
                        break
            title = graph_data["name"]
        except KeyError:
            raise Exception(
                f"Pair {graph} {spec} does not have base graph name provided"  # noqa: E501
            )
    exampleentries.extend(
        [
            f"* {title}",
            "```{pipeline_manager}",
            f":spec: {spec}",
            f":graph: {graph}",
            "```",
        ]
    )
myst_substitutions["examples"] = "\n".join(exampleentries)

today_fmt = "%Y-%m-%d"

todo_include_todos = False

html_theme = "sphinx_immaterial"

html_last_updated_fmt = today_fmt

html_show_sphinx = False

html_static_path = ["_static"]

html_css_files = ("css/styles.css",)

(html_logo, html_theme_options, html_context) = antmicro_html(
    gh_slug="antmicro/kenning-pipeline-manager",
    pdf_url=f"{basic_filename}.pdf",
)

html_title = project

(
    latex_elements,
    latex_documents,
    latex_logo,
    latex_additional_files,
) = antmicro_latex(basic_filename, authors, project)
latex_elements.update({"maxlistdepth": "10"})

myst_url_schemes = {
    "http": None,
    "https": None,
    "resource": "{{path}}",
    "demo": "{{path}}?{{query}}",
}

mermaid_cmd = "./mmdc"
mermaid_params = ["--cssFile", "source/_static/css/styles.css"]
mermaid_d3_zoom = True
