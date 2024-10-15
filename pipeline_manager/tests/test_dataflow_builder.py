"""Module with tests for dataflow building process."""

import json

import pytest

from pipeline_manager.dataflow_builder.dataflow_builder import DataflowBuilder
from pipeline_manager.dataflow_builder.dataflow_graph import DataflowGraph
from pipeline_manager.dataflow_builder.entities import (
    Direction,
    Interface,
    Property,
    Vector2,
)


@pytest.fixture
def builder() -> DataflowBuilder:
    return DataflowBuilder(
        dataflow_path="/dev/null",
        specification_path="examples/sample-specification.json",
        override_existing_dataflow=True,
    )


def test_creating_empty_graph(builder):
    """Test if an empty graph has a proper format after conversion to JSON."""
    graph = builder.create_graph()

    assert type(graph) == DataflowGraph
    assert json.loads(graph.to_json()) == {
        "id": f"{graph._id}",
        "nodes": [],
        "connections": [],
    }


def test_adding_node_present_in_specification(builder):
    """Test if an node is added correctly to a dataflow graph."""
    graph = builder.create_graph()
    node = graph.create_node()

    node.name = "LoadVideo"
    node.position = Vector2(0, 0)
    node.width = 200
    node.two_column = False

    interfaces = []
    interface = Interface(
        direction=Direction.OUTPUT, name="frames", side_position=0
    )
    interfaces.append(interface)

    properties = []
    prop = Property(name="filename", value="input4.mp4")

    node.interfaces = interfaces
    node.properties = properties

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
                        "id": interface.id,
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
            },
        ],
        "connections": [],
    }
