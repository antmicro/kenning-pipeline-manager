# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

import os
import json
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
extensions = default_extensions
myst_enable_extensions = default_myst_enable_extensions
myst_fence_as_directive = default_myst_fence_as_directive

myst_substitutions = {
    "project": project,
    "examples": 'To see the work of the frontend, check HTML documentation or follow [Building and Running](project-readme.md#building-and-running).'  # noqa: E501
}

html_build_dir = Path(os.environ['BUILDDIR']) / 'html'

if html_build_dir.is_dir():
    exampleentries = ['To see the work of the frontend check one of the below examples:\n']  # noqa: E501
    for example in (html_build_dir / 'static-demo').iterdir():
        relexample = example.relative_to(html_build_dir)
        title = ""
        try:
            with open(example / "graph.json", 'r') as f:
                title = json.load(f)['graph']['name']
        except (KeyError, FileNotFoundError):
            title = relexample.stem
        exampleentries.append(f'* [{title}](resource:{relexample}/index.html) ([Graph](resource:{relexample}/graph.json), [Spec](resource:{relexample}/spec.json))')  # noqa: E501
    myst_substitutions["examples"] = '\n'.join(exampleentries)

today_fmt = '%Y-%m-%d'

todo_include_todos = False

html_theme = 'sphinx_immaterial'

html_last_updated_fmt = today_fmt

html_show_sphinx = False

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

myst_url_schemes = {
    "http": None,
    "https": None,
    "resource": "{{path}}"
}
