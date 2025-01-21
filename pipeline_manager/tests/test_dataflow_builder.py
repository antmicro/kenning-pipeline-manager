"""Module with tests for dataflow building process."""

from pathlib import Path
from typing import Dict, Tuple

import pytest

from pipeline_manager.dataflow_builder.dataflow_builder import GraphBuilder
from pipeline_manager.dataflow_builder.dataflow_graph import (
    AttributeType,
    DataflowGraph,
)
from pipeline_manager.dataflow_builder.entities import (
    Direction,
    NodeAttributeType,
    Property,
    Vector2,
)

DEFAULT_SPECIFICATION_VERSION = "20240723.13"


@pytest.fixture
def builder() -> GraphBuilder:
    return GraphBuilder(
        specification="examples/sample-specification.json",
        specification_version=DEFAULT_SPECIFICATION_VERSION,
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
) -> Tuple[GraphBuilder, DataflowGraph, Dict]:
    """
    Fixture providing a valid graph with two node a single connection
    between them.
    """
    graph = builder.create_graph()

    source = graph.create_node(
        name="LoadVideo",
        position=Vector2(0, 0),
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

    [from_node] = graph.get(AttributeType.NODE, name="LoadVideo")
    [to_node] = graph.get(AttributeType.NODE, name="LoadVideo")

    with pytest.raises(ValueError):
        graph.create_connection(
            from_interface=from_node.interfaces[0],
            to_interface=to_node.interfaces[0],
        )


def test_passing_validation_with_simple_graph(single_connection_graph):
    """Test whether GraphBuilder with a simple graph passes validation."""
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
    assert found == node, "Retrieved a different node than expected."


@pytest.mark.parametrize(
    "search_criteria,results_count",
    (
        ({}, 2),
        ({"direction": Direction.INPUT}, 1),
        ({"direction": Direction.OUTPUT}, 1),
        ({"direction": Direction.INOUT}, 0),
    ),
)
def test_getting_interfaces_from_graph(
    search_criteria: Dict, results_count: int, single_connection_graph
):
    """Test if interfaces may be retrieved."""
    _, graph, _ = single_connection_graph

    all_interfaces = graph.get(type=AttributeType.INTERFACE, **search_criteria)

    assert (
        len(all_interfaces) == results_count
    ), f"Failed to retrieve {results_count} interfaces."


def test_getting_connections_from_graph(single_connection_graph):
    """Test if connections may be retrieved from a graph with `get` method."""
    _, graph, _ = single_connection_graph
    [node] = graph.get(AttributeType.NODE, name="LoadVideo")
    [found_interface] = node.get(NodeAttributeType.INTERFACE)

    [retrieved_connection] = graph.get(
        AttributeType.CONNECTION, from_interface=found_interface
    )

    [original_connection_id] = graph._connections
    original_connection = graph._connections[original_connection_id]
    assert (
        retrieved_connection == original_connection
    ), "Retrieved a different connection than expected."


def test_getting_connection_from_graph_by_id(single_connection_graph):
    """Test if a connection may be retrieved by its id."""
    _, graph, _ = single_connection_graph
    [original_connection] = list(graph._connections.values())

    retrieved_connection = graph.get_by_id(
        AttributeType.CONNECTION, id=original_connection.id
    )

    assert (
        retrieved_connection == original_connection
    ), "Retrieved a different connection than expected with id."


# LoadVideo starts at (0, 0).
# SaveVideo starts at (2100, 200).
@pytest.mark.parametrize(
    "node_name,shift,expected_position",
    (
        ("LoadVideo", Vector2(200, 200), Vector2(200, 200)),
        ("SaveVideo", Vector2(200, 200), Vector2(2300, 400)),
        ("LoadVideo", Vector2(-1000, 0), Vector2(-1000, 0)),
        ("LoadVideo", Vector2(0, -(2**16) - 1), Vector2(0, -(2**16))),
        ("SaveVideo", Vector2(-9999999, 0), Vector2(-(2**16), 200)),
        ("SaveVideo", Vector2(0, -199), Vector2(2100, 1)),
    ),
)
def test_relative_node_motion(
    node_name: str,
    shift: Vector2,
    expected_position: Vector2,
    single_connection_graph,
):
    """Test if a node is moved relative to its previous position."""
    _, graph, _ = single_connection_graph
    [node] = graph.get(AttributeType.NODE, name=node_name)

    node.move(shift, relative=True)

    assert (
        node.position == expected_position
    ), "Failed to properly re-position a node."


@pytest.mark.parametrize(
    "node_name,new_position,expected_position",
    (
        ("LoadVideo", Vector2(200, 200), Vector2(200, 200)),
        ("SaveVideo", Vector2(200, 200), Vector2(200, 200)),
        ("SaveVideo", Vector2(1, 2), Vector2(1, 2)),
        (
            "LoadVideo",
            Vector2(-(2**17), 0),
            Vector2(Vector2._minimal_value, 0),
        ),
        (
            "SaveVideo",
            Vector2(-(2**17), 0),
            Vector2(Vector2._minimal_value, 0),
        ),
        ("SaveVideo", Vector2(2**20, 0), Vector2(Vector2._maximal_value, 0)),
        ("LoadVideo", Vector2(2**20, 5), Vector2(Vector2._maximal_value, 5)),
    ),
)
def test_absolute_node_motion(
    node_name: str,
    new_position: Vector2,
    expected_position: Vector2,
    single_connection_graph,
):
    """Test if a node is moved independently of its previous position."""
    _, graph, _ = single_connection_graph
    [node] = graph.get(AttributeType.NODE, name=node_name)

    node.move(new_position, relative=False)

    assert (
        node.position == expected_position
    ), "Failed to properly re-position a node."


@pytest.fixture
def sample_specification_path():
    """Fixture providing path to a file with a sample specification."""
    return Path("examples/sample-specification.json")


@pytest.fixture
def sample_dataflow_path():
    """Fixture providing path to a file with a sample dataflow graph."""
    return Path("examples/sample-dataflow.json")


def test_using_sample_graphs(sample_specification_path, sample_dataflow_path):
    """
    Test if using a sample specification and a sample dataflow
    passes validation.
    """
    builder = GraphBuilder(
        specification=sample_specification_path,
        specification_version=DEFAULT_SPECIFICATION_VERSION,
    )
    builder.load_graphs(dataflow_path=sample_dataflow_path)

    builder.validate()


def test_modifying_sample_graph(
    sample_specification_path, sample_dataflow_path
):
    """
    Test if adding a node and connecting it
    to a sample graph yields no errors.
    """
    builder = GraphBuilder(
        specification=sample_specification_path,
        specification_version=DEFAULT_SPECIFICATION_VERSION,
    )
    builder.load_graphs(dataflow_path=sample_dataflow_path)
    graph = builder.graphs[0]
    builder.validate()

    second_storage = graph.create_node(name="SaveVideo")
    second_storage.move(Vector2(1500, 1000))

    [morphological_operation] = graph.get(
        AttributeType.NODE, name="Morphological operation"
    )
    [source] = morphological_operation.get(
        NodeAttributeType.INTERFACE, direction=Direction.OUTPUT
    )
    [drain] = second_storage.get(
        NodeAttributeType.INTERFACE, direction=Direction.INPUT
    )

    graph.create_connection(from_interface=source, to_interface=drain)

    builder.validate()


def test_raising_error_when_using_non_existent_keyword_argument(
    sample_specification_path, sample_dataflow_path
):
    """
    Test if an KeyError is raised when a non-existent
    keyword argument is used.
    """
    builder = GraphBuilder(
        specification=sample_specification_path,
        specification_version=DEFAULT_SPECIFICATION_VERSION,
    )
    builder.load_graphs(dataflow_path=sample_dataflow_path)
    graph = builder.graphs[0]
    with pytest.raises(KeyError):
        graph.create_node(name="LoadVideo", non_existent_keyword_arg=123)
