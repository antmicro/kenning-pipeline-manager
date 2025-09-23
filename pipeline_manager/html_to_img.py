#!/usr/bin/env python3

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Script for converting input HTML file to interactive SVG file.
"""

import argparse
import base64
import logging
from pathlib import Path


def html_to_png(input_html: Path, output_png: Path):
    """
    Creates a png file from input HTML file.

    Parameters
    ----------
    input_html : Path
        Path to the input HTML file
    output_png: Path
        Path to the output png file
    """
    from html2image import Html2Image

    out_dir = output_png.parent

    hti = Html2Image(
        size=(1920, 1080),
        custom_flags=[
            "--virtual-time-budget=10000",
            "--hide-scrollbars",
            "--disable-gpu",
            "--no-sandbox",
        ],
        output_path=out_dir,
    )

    hti.browser.use_new_headless = True
    hti.screenshot(
        url=f"file://{input_html}?preview=true",
        save_as=str(output_png.name),
    )


def html_to_svg(input_html: Path, output_svg: Path):
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Converter from HTML to interactive SVG"
    )
    parser.add_argument(
        "input_html",
        help="Input html",
    )
    parser.add_argument(
        "output_img",
        help="Output image, format deduced automatically or via --format "
        "argument",
        type=Path,
    )
    parser.add_argument("--format", help="Format of the image saved", type=str)

    args = parser.parse_args()

    args = {k: v for k, v in vars(args).items() if v is not None}
    format = None
    if "format" in args:
        format = args["format"]
    else:
        format = args["output_img"].suffix[1:]

    if format == "svg":
        html_to_svg(args["input_html"], args["output_img"])
    elif format == "png":
        html_to_png(args["input_html"], args["output_img"])
    else:
        logging.error(f"Html to {format} conversion is not supported")
