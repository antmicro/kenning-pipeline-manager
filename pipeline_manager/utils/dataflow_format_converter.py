# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
A script for converting older versions of dataflow to newer versions.
"""

import argparse
import json
import logging
import sys
from pathlib import Path

# from pipeline_manager.utils.logger import string_to_verbosity

"""
Script that can be used to apply patches to update an old dataflow
format to a newest one.

Usage of the script:

```
python -m pipeline_manager.utils.dataflow_format_converter \
    old_format_dataflow.json
```
"""


def dataflow_ver_20230615_1(dataflow: dict) -> dict:
    """
    Converts dataflows to version 20230615.1.

    Parameters
    ----------
    dataflow : dict
        Dataflow to be converted

    Returns
    -------
    dict
        Converted dataflow to the next version
    """
    dataflow["version"] = "20230615.1"
    return dataflow


def dataflow_ver_20230830_11(dataflow: dict) -> dict:
    """
    Converts dataflows to version 20230830.11.

    Parameters
    ----------
    dataflow : dict
        Dataflow to be converted

    Returns
    -------
    dict
        Converted dataflow to the next version
    """
    dataflow["version"] = "20230830.11"

    def parse_graph(graph):
        for node in graph["nodes"]:
            if "name" in node:
                node["instanceName"] = node["name"]
                del node["name"]

            node["name"] = node["type"]
            del node["type"]

    parse_graph(dataflow["graph"])
    if "graphTemplateInstances" in dataflow:
        for subgraph in dataflow["graphTemplateInstances"]:
            parse_graph(subgraph)

    dataflow["subgraphs"] = dataflow["graphTemplateInstances"]
    del dataflow["graphTemplateInstances"]

    return dataflow


def main(argv):  # noqa: D103
    parser = argparse.ArgumentParser(argv[0])
    parser.add_argument(
        "dataflow", type=Path, help="Input dataflow to be converted"
    )
    parser.add_argument(
        "--from-version",
        type=str,
        default="pre-20230615.1",
        help="Version of the input dataflow."
        + "All patches starting from this version are going to be applied",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default="out.json",
        help="Output JSON with updated dataflow",
    )
    parser.add_argument(
        "--verbosity",
        help="Verbosity level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default="DEBUG",
        type=str,
    )
    args, _ = parser.parse_known_args(argv[1:])
    # logging.basicConfig(level=string_to_verbosity(args.verbosity))

    args, _ = parser.parse_known_args(argv[1:])

    with open(args.dataflow) as f:
        dataflow = json.load(f)

    dataflow_patches = {
        "pre-20230615.1": dataflow_ver_20230615_1,
        "20230824.10": dataflow_ver_20230830_11,
    }

    try:
        first_patch = list(dataflow_patches.keys()).index(args.from_version)
    except ValueError:
        logging.error(f"Version - {args.from_version} is not valid")
        return

    for ver, patch in list(dataflow_patches.items())[first_patch:]:
        logging.info(f"Applying patch from version - {ver}")
        dataflow = patch(dataflow)

    with open(args.output, "w") as f:
        json.dump(dataflow, f, indent=4)


if __name__ == "__main__":
    main(sys.argv)
