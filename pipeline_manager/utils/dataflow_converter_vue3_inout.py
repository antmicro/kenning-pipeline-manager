# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Version: 2
Script that convert old dataflow format (Vue3-based) to a new one supporting
inouts.

Usage of the script:

```
python -m pipeline_manager.utils.dataflow_converter_vue3_inout \
    old_format_dataflow.json \
    --output new_format_dataflow.json
```
"""

import argparse
import json
import sys
from pathlib import Path


def main(argv):  # noqa: D103
    parser = argparse.ArgumentParser(argv[0])
    parser.add_argument(
        "dataflow", type=Path, help="Input dataflow with version before inouts"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default="out.json",
        help="Output JSON with updated dataflow",
    )

    args, _ = parser.parse_known_args(argv[1:])

    with open(args.dataflow) as f:
        loaded = json.load(f)
        graph = loaded["graph"]

    for node in graph["nodes"]:
        node["interfaces"] = []
        for name, state in node["inputs"].items():
            node["interfaces"].append(
                {"name": name, "id": state["id"], "direction": "input"}
            )

        for name, state in node["outputs"].items():
            node["interfaces"].append(
                {"name": name, "id": state["id"], "direction": "output"}
            )

        newProperties = []
        for name, state in node["properties"].items():
            newProperties.append(
                {"name": name, "id": state["id"], "value": state["value"]}
            )
        node["properties"] = newProperties
        del node["inputs"]
        del node["outputs"]

    with open(args.output, "w") as f:
        json.dump(loaded, f, indent=4)


if __name__ == "__main__":
    main(sys.argv)
