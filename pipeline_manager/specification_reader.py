# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0


def collect_dependencies(resolved_types, specification_nodes_map, curr_type):
    """
    Performs quick recursive collection of base type for the current type.

    Parameters
    ----------
    resolved_types: List
        List of resolved types
    specification_nodes_map: Dict[str, object]
        Mapping from node type name to node type definition
    curr_type: str
        Currently processed type
    """
    if curr_type in resolved_types:
        return
    resolved_types.append(curr_type)
    if "extends" in specification_nodes_map[curr_type]:
        for partype in specification_nodes_map[curr_type]["extends"]:
            collect_dependencies(
                resolved_types,
                specification_nodes_map,
                partype
            )


def minify_specification(specification, dataflow):
    """
    Creates a minimal specification for a given dataflow.

    Only node types used in dataflow will be passed to
    specification.

    Parameters
    ----------
    specification: Dict
        Structure defining the specification
    dataflow: Dict
        Structure defining the graph

    Returns
    -------
    Dict : Updated specification
    """
    used_types = []
    for node in dataflow["graph"]["nodes"]:
        if node["type"] not in used_types:
            used_types.append(node["type"])

    resolved_types = []
    names_to_types = {node["name"]: node for node in specification["nodes"]}
    for nodetype in used_types:
        collect_dependencies(resolved_types, names_to_types, nodetype)

    new_nodes = []

    for entry in resolved_types:
        new_nodes.append(names_to_types[entry])

    specification["nodes"] = new_nodes
    return specification


def retrieve_used_icons(specification) -> list[str]:
    """
    Retrives names of used icons from the dataflow

    Parameters
    ----------
    specification: Dict
        Minified specification
    Returns
    -------
    List : names of used icons
    """
    icon_names = []

    if "urls" in specification["metadata"]:
        for url in specification["metadata"]["urls"].values():
            icon_names.append(url['icon'])

    for node in specification["nodes"]:
        if "icon" in node:
            filename = node["icon"]
            icon_names.append(filename)

    return icon_names
