"""Module with tests for dataflow building process."""

from typing import Dict, Tuple

import pytest

from pipeline_manager.dataflow_builder.dataflow_builder import DataflowBuilder
from pipeline_manager.dataflow_builder.dataflow_graph import (
    AttributeType,
    DataflowGraph,
)
from pipeline_manager.dataflow_builder.entities import (
    Property,
    Vector2,
)


@pytest.fixture
def builder() -> DataflowBuilder:
    return DataflowBuilder(
        specification="examples/sample-specification.json",
    )


def test_creating_empty_graph(builder):
    """Test if an empty graph has a proper format after conversion to JSON."""
    graph = builder.create_graph()

    assert type(graph) == DataflowGraph
    assert graph.to_json(as_str=False) == {
        "id": f"{graph._id}",
        "nodes": [],
        "connections": [],
    }


def test_adding_node_present_in_specification(builder):
    """Test if an node is added correctly to a dataflow graph."""
    graph = builder.create_graph()
    node = graph.create_node(
        name="LoadVideo",
        position=Vector2(0, 0),
        width=200,
        two_column=False,
    )

    prop = Property(name="filename", value="input.mp4")
    node.properties = [prop]

    assert graph.to_json(as_str=False) == {
        "id": f"{graph._id}",
        "nodes": [
            {
                "name": "LoadVideo",
                "id": node.id,
                "position": {
                    "x": 0,
                    "y": 0,
                },
                "width": 200,
                "twoColumn": False,
                "interfaces": [
                    {
                        "name": "frames",
                        "id": node.interfaces[0].id,
                        "direction": "output",
                        "side": "right",
                        "sidePosition": 0,
                    }
                ],
                "properties": [
                    {
                        "name": "filename",
                        "id": prop.id,
                        "value": "input.mp4",
                    }
                ],
                "enabledInterfaceGroups": [],
            },
        ],
        "connections": [],
    }


def test_adding_node_absent_in_specification(builder):
    """
    Tests if a provided node fails to add because it is not present
    in specification.
    """
    graph = builder.create_graph()

    with pytest.raises(ValueError):
        graph.create_node(name="Name Not in Specification")


@pytest.mark.parametrize("n", [3, 5, 20, 50])
def test_adding_multiple_nodes(n: int, builder):
    """Test if an expected number of nodes is created."""
    graph = builder.create_graph()

    for _ in range(n):
        graph.create_node(name="LoadVideo")

    created_nodes = len(graph._nodes)
    assert created_nodes == n, (
        f"Expected to created {n} nodes but actually {created_nodes} nodes "
        "have been created in the internal representation."
    )
    nodes_created_in_json = len(graph.to_json(as_str=False)["nodes"])
    assert nodes_created_in_json == n, (
        f"Expected to created {n} nodes but actually {nodes_created_in_json} "
        "nodes have been created in the JSON output."
    )


@pytest.fixture
def single_connection_graph(
    builder
) -> Tuple[DataflowBuilder, DataflowGraph, Dict]:
    """
    Fixture providing a valid graph with two node a single connection
    between them.
    """
    graph = builder.create_graph()

    source = graph.create_node(
        name="LoadVideo",
    )

    drain = graph.create_node(
        name="SaveVideo",
        position=Vector2(2100, 200),
    )

    connection = graph.create_connection(
        from_interface=source.interfaces[0],
        to_interface=drain.interfaces[0],
    )

    expected = {
        "id": f"{graph._id}",
        "nodes": [
            {
                "name": "LoadVideo",
                "id": source.id,
                "position": {
                    "x": 0,
                    "y": 0,
                },
                "width": 200,
                "twoColumn": True,
                "interfaces": [
                    {
                        "name": "frames",
                        "id": source.interfaces[0].id,
                        "direction": "output",
                        "side": "right",
                        "sidePosition": 0,
                    }
                ],
                "properties": [],
                "enabledInterfaceGroups": [],
            },
            {
                "id": drain.id,
                "position": {"x": 2100, "y": 200},
                "width": 200,
                "twoColumn": True,
                "interfaces": [
                    {
                        "name": "frames",
                        "id": drain.interfaces[0].id,
                        "direction": "input",
                        "side": "left",
                        "sidePosition": 0,
                    }
                ],
                "properties": [],
                "enabledInterfaceGroups": [],
                "name": "SaveVideo",
            },
        ],
        "connections": [
            {
                "from": source.interfaces[0].id,
                "id": connection.id,
                "to": drain.interfaces[0].id,
            },
        ],
    }

    return builder, graph, expected


def test_adding_connection(single_connection_graph):
    """Test if adding a connection between two existing nodes succeeds."""
    _, graph, expected = single_connection_graph
    assert graph.to_json(as_str=False) == expected


def test_if_adding_duplicate_connection_fails(single_connection_graph):
    """
    Test if adding a duplicate of an existing connection between two existing
    nodes fails.
    """
    _, graph, expected = single_connection_graph
    assert graph.to_json(as_str=False) == expected

    from_node = graph.get(AttributeType.NODE, name="LoadVideo")
    to_node = graph.get(AttributeType.NODE, name="LoadVideo")

    with pytest.raises(ValueError):
        graph.create_connection(
            from_interface=from_node.interfaces[0],
            to_interface=to_node.interfaces[0],
        )


def test_passing_validation_with_simple_graph(single_connection_graph):
    """Test whether DataflowBuilder with a simple graph passes validation."""
    builder, _, _ = single_connection_graph
    # If validation fails, an error will be raised.
    builder.validate()


def test_getting_nodes(single_connection_graph):
    """Test if nodes may be retrieved from a graph with `get` method."""
    _, graph, _ = single_connection_graph
    node_name = "LoadVideo"

    found = graph.get(AttributeType.NODE, name=node_name)

    assert (
        len(found) == 1
    ), f"Exactly one element should be found but found {len(found)}."
    assert found[0].name == node_name, (
        f"Retrieved a wrong node. Expected name `{node_name}` "
        f"but found `{found[0].name}`."
    )


def test_getting_node_by_id(single_connection_graph):
    """Test if a node may be retrieved by its id."""
    _, graph, _ = single_connection_graph
    nodes = [value for _, value in graph._nodes.items()]
    node = nodes[0]

    found = graph.get_by_id(AttributeType.NODE, node.id)

    assert found is not None, "A node was not found while it should be found."
    # Dataclasses equality is determined on attributes equality basis.
    assert node == found, "Retrieved a different node than expected."


def test_getting_connections(single_connection_graph):
    """Test if connections may be retrieved from a graph with `get` method."""
    _, graph, _ = single_connection_graph

    # nodes = [value for _, value in graph._nodes.items()]
    # node = nodes[0]
    # node.interfaces[]

    # TODO: Implement user-friendly interface getting from node and graph.
    # interface = InterfaceConnection(
    # id=
    # )
    # found = graph.get(AttributeType.CONNECTION, from_interface=)
    # found = graph.get(AttributeType.NODE, name=node_name)

    # assert (
    #     len(found) == 1
    # ), f"Exactly one element should be found but found {len(found)}."
    # assert found[0].name == node_name, (
    #     f"Retrieved a wrong node. Expected name `{node_name}` "
    #     f"but found `{found[0].name}`."
    # )
    raise NotImplementedError()


def test_getting_connection_by_id(single_connection_graph):
    """Test if a connection may be retrieved by its id."""
    # _, graph, _ = single_connection_graph
    # nodes = [value for _, value in graph._nodes.items()]
    # node = nodes[0]

    # found = graph.get_by_id(AttributeType.NODE, node.id)

    # assert found, f"Failed get a node by its id `{node.id}`."
    # assert (
    #     found.name == node.name
    # ), "Retrieved node has a different name than expected."
    # assert (
    #     found.position == node.position
    # ), "Retrieved node has a different position than expected."
    raise NotImplementedError()
