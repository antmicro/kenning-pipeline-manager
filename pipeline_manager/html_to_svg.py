#!/usr/bin/env python3

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Script for converting input HTML file to interactive SVG file.
"""

import base64
import argparse


def html_to_svg(input_html, output_svg):
    """
    Creates an interactive SVG file from input HTML file.

    The SVG file is only openable in browsers.

    Parameters
    ----------
    input_html : Path
        Path to the input HTML file
    output_svg: Path
        Path to the output SVG file
    """

    template = """
<svg version="1.1" xmlns="http://www.w3.org/2000/svg">
    <style>
    iframe {{
        border: none;
    }}
    </style>
    <foreignObject x="0" y="0" width="100%" height="100%">
        <iframe
            id="app"
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/1999/xhtml">
        </iframe>
        <script type="text/javascript"><![CDATA[
        let i = document.getElementById('app');
        i.contentWindow.document.open();
        i.contentWindow.document.write(atob('{}'));
        i.contentWindow.document.close();
        ]]></script>
    </foreignObject>
</svg>
"""

    with open(input_html, "br") as f:
        b = base64.b64encode(f.read())
    with open(output_svg, "w") as f:
        f.write(template.format(b.decode()))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Converter from HTML to interactive SVG"
    )
    parser.add_argument(
        "input_html",
        help="Input html",
    )
    parser.add_argument(
        "output_svg",
        help="Output svg file"
    )

    args = parser.parse_args()

    args = {k: v for k, v in vars(args).items() if v is not None}

    html_to_svg(**args)
