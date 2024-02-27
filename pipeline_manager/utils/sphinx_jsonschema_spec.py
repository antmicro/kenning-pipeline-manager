#!/usr/bin/env python3

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Creates documentation entries from JSON schema files.
"""

import json
import re
from importlib import resources
from typing import Dict, List
from urllib.parse import quote

import jsonschema2md

from pipeline_manager.resources import api_specification

PARSER = jsonschema2md.Parser()


def _parse_type(schema: Dict):
    """
    Function changing all `type` values from list to string.

    It is done for more consistent types in generated specification.

    Parameters
    ----------
    schema : Dict
        Specification in jsonschema format
    """
    for key, value in schema.items():
        if key == "type" and isinstance(value, List):
            schema[key] = f"[{', '.join(value)}]"
        elif isinstance(value, Dict):
            _parse_type(value)


def generate_for_endpoints(spec: Dict, reference_prefix: str) -> List[str]:
    """
    Generates Markdown with API specification for endpoints
    from chosen service.

    Parameters
    ----------
    spec : Dict
        Specification with endpoints containing `params`,
        `results` and `description`
    reference_prefix : str
        Prefix for the MyST reference.

    Returns
    -------
    List[str]
        Markdown with generated specification divided into lines
    """
    results = []
    for name, schema in spec.items():
        results.append(f'({reference_prefix}-{name.replace("_", "-")})=\n')
        results.append(f"#### {name}\n\n")
        if "description" in schema:
            results.append(schema["description"] + "\n\n")
        if "params" in schema:
            results.extend(PARSER._parse_object(schema["params"], "params"))
        if "returns" in schema and schema["returns"]:
            results.extend(PARSER._parse_object(schema["returns"], "result"))
    return results


def generate_schema_md() -> str:
    """
    Generate API specification in Markdown format,
    based on definition from jsonSchema file.

    Returns
    -------
    str
        Markdown with API specification
    """
    results: List[str] = []
    spec_path = resources.files(api_specification) / "specification.json"
    with open(spec_path, "r") as fd:
        specification = json.load(fd)
    _parse_type(specification)
    for ref, header, content in (
        (
            "(frontend-api)=\n",
            "### Frontend API\n\n",
            generate_for_endpoints(
                specification["frontend_endpoints"], "frontend"
            ),
        ),
        (
            "(backend-api)=\n",
            "### Backend API\n\n",
            generate_for_endpoints(
                specification["backend_endpoints"], "backend"
            ),
        ),
        (
            "(external-app-api)=\n",
            "### External App API\n\n",
            generate_for_endpoints(
                specification["external_endpoints"], "external"
            ),
        ),
    ):
        results.append(ref)
        results.append(header)
        results.extend(content)

    types_path = resources.files(api_specification) / "common_types.json"
    with open(types_path, "r") as fd:
        common_types = json.load(fd)
    _parse_type(common_types)
    results.append("(api-common-types)=\n")
    results.append("### Common Types\n\n")
    for name, definition in common_types["$defs"].items():
        results.append(f"({quote(f'mmon_types#/$defs/{name}')})=\n\n")
        results.append(f"#### {name}\n\n")
        results.extend(PARSER._parse_object(definition, None))

    for idx, item in enumerate(results):
        # NOTE: Modify regex if specification changes
        occurrences = re.findall(r"\[common_types#/\$defs/(\w+)\]", item)
        for occurrence in occurrences:
            results[idx] = item.replace(
                f"[common_types#/$defs/{occurrence}]", f"[{occurrence}]"
            )

    return "".join(
        [
            result.replace(":", "", 1)
            if result.lstrip().startswith("- :")
            else result
            for result in results
        ]
    )
