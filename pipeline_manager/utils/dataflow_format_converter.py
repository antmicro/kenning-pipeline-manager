# Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
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

from pipeline_manager.utils.logger import string_to_verbosity

"""
Script that can be used to apply patches to update an old dataflow
format to a newest one.

Usage of the script:

```
python -m pipeline_manager.utils.dataflow_format_converter \
    old_format_dataflow.json
```
"""


class ConversionError(Exception):
    """
    Exception raised when conversion fails.
    """

    pass


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


def dataflow_ver_20240723_13(dataflow: dict) -> dict:
    """
    Converts dataflows to version 20240723.13.

    Parameters
    ----------
    dataflow : dict
        Dataflow to be converted

    Raises
    ------
    ConversionError
        Raised if subgraphs are present in the dataflow, as they
        are not supported by this converter

    Returns
    -------
    dict
        Converted dataflow to the next version
    """
    dataflow["version"] = "20240723.13"
    if "subgraphs" in dataflow:
        raise ConversionError(
            "Subgraphs conversion is not supported in version 20240723.13"
        )

    if "graph" in dataflow:
        main_graph = dataflow["graph"]
        dataflow["graphs"] = [main_graph]
        del dataflow["graph"]
    else:
        logging.warning(
            "No 'graph' property to convert. "
            + "Make sure the dataflow format is correct.",
        )

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
    logging.basicConfig(level=string_to_verbosity(args.verbosity))

    args, _ = parser.parse_known_args(argv[1:])

    with open(args.dataflow) as f:
        dataflow = json.load(f)

    dataflow_patches = {
        "pre-20230615.1": dataflow_ver_20230615_1,
        "20230830.11": dataflow_ver_20240723_13,
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
        json.dump(dataflow, f, indent=4, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv)
