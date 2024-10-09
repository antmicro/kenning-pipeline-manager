"""Module with tests for dataflow building process."""

import json

import pytest

from pipeline_manager.dataflow_builder.dataflow_builder import DataflowBuilder
from pipeline_manager.dataflow_builder.dataflow_graph import DataflowGraph


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
