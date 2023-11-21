# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import os
import json
import urllib.parse
from pathlib import Path
from datetime import datetime

from antmicro_sphinx_utils.defaults import (
    numfig_format as default_numfig_format,
    extensions as default_extensions,
    myst_enable_extensions as default_myst_enable_extensions,
    myst_fence_as_directive as default_myst_fence_as_directive,
    antmicro_html,
    antmicro_latex
)

from pipeline_manager.utils.sphinx_jsonschema_spec import generate_schema_md
from sphinxcontrib import mermaid


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
project = u'Pipeline Manager'
basic_filename = u'pipeline-manager'
authors = u'Antmicro'
copyright = f'{authors}, {datetime.now().year}'

sphinx_immaterial_override_builtin_admonitions = False

numfig = True
numfig_format = default_numfig_format

myst_heading_anchors = 6


# If you need to add extensions just add to those lists
extensions = list(set(default_extensions + [
    'sphinx.ext.napoleon'
]))
myst_enable_extensions = default_myst_enable_extensions
myst_fence_as_directive = default_myst_fence_as_directive

myst_substitutions = {
    "project": project,
    "examples": 'To see the work of the frontend, check HTML documentation or follow [Building and Running](project-readme.md#building-and-running).',  # noqa: E501
    "api_specification": generate_schema_md(),
}

html_build_dir = Path(os.environ['BUILDDIR']) / 'html'

if html_build_dir.is_dir():
    exampleentries = ['To see the work of the frontend check one of the below examples:\n']  # noqa: E501
    static_demo_dir = html_build_dir / 'static-demo'
    for example in (static_demo_dir / 'graphs').glob('*-dataflow.json'):
        relexample = example.relative_to(static_demo_dir)
        graphname = example.stem.replace('-dataflow', '')
        spec = example.parent / f'{graphname}-specification.json'
        relspec = spec.relative_to(static_demo_dir)
        title = ""
        try:
            with open(example, 'r') as f:
                title = json.load(f)['graph']['name']
        except (KeyError, FileNotFoundError):
            title = relexample.stem.replace('-dataflow', '')
        params = {
            "spec": f"relative://{relspec}",
            "graph": f"relative://{relexample}"
        }
        encoded_pm_params = urllib.parse.urlencode(params)
        exampleentries.append(f'* [{title}](demo:static-demo/index.html?{encoded_pm_params}) ([Graph](resource:static-demo/{relexample}), [Spec](resource:static-demo/{relspec}))')  # noqa: E501
    myst_substitutions["examples"] = '\n'.join(exampleentries)

today_fmt = '%Y-%m-%d'

todo_include_todos = False

html_theme = 'sphinx_immaterial'

html_last_updated_fmt = today_fmt

html_show_sphinx = False

html_static_path = ['_static']

html_css_files = (
    'css/styles.css',
)

(
    html_logo,
    html_theme_options,
    html_context
) = antmicro_html(
    gh_slug='antmicro/kenning-pipeline-manager'
)

html_title = project

(
    latex_elements,
    latex_documents,
    latex_logo,
    latex_additional_files
) = antmicro_latex(basic_filename, authors, project)
latex_elements.update({
    'maxlistdepth': '10'
})

myst_url_schemes = {
    "http": None,
    "https": None,
    "resource": "{{path}}",
    "demo": "{{path}}?{{query}}"
}

mermaid_cmd = './mmdc'
mermaid_params = ['--cssFile', 'source/_static/css/styles.css']
mermaid_d3_zoom = True
