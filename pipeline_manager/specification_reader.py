# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0


def collect_dependencies(resolved_names, specification_nodes_map, curr_name):
    """
    Performs quick recursive collection of base type for the current type.

    Parameters
    ----------
    resolved_names: List
        List of resolved types
    specification_nodes_map: Dict[str, object]
        Mapping from node type name to node definition
    curr_name: str
        Currently processed name
    """
    if curr_name in resolved_names:
        return
    resolved_names.append(curr_name)
    if "extends" in specification_nodes_map[curr_name]:
        for partype in specification_nodes_map[curr_name]["extends"]:
            collect_dependencies(
                resolved_names,
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
    used_names = []
    for node in dataflow["graph"]["nodes"]:
        if node["name"] not in used_names:
            used_names.append(node["name"])

    resolved_names = []
    names_to_nodes = {node["name"]: node for node in specification["nodes"]}
    for nodename in used_names:
        collect_dependencies(resolved_names, names_to_nodes, nodename)

    new_nodes = []

    for entry in resolved_names:
        new_nodes.append(names_to_nodes[entry])

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
