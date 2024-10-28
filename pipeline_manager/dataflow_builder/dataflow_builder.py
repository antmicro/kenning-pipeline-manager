"""Module with DataflowBuilder class, sharing its API publicly."""

import json
from pathlib import Path
from typing import Tuple, Union

from pipeline_manager.dataflow_builder.dataflow_graph import DataflowGraph
from pipeline_manager.dataflow_builder.utils import is_proper_input_file


class DataflowBuilder:
    """Class for building dataflow graph."""

    def __init__(
        self,
        input_dataflow: Union[Path, str, DataflowGraph, None],
        specification: Union[Path, str],
        # override_existing_dataflow: bool = False,
    ) -> None:
        """Initialise class attribute, perform basic checks."""
        # # Handling a resulting dataflow file.
        # if isinstance(output_dataflow, str):
        #     output_dataflow = Path(output_dataflow)

        # output_dataflow = output_dataflow.resolve()
        # if output_dataflow.exists() and not override_existing_dataflow:
        #     raise FileExistsError(
        #         f"Specification file {output_dataflow} already exists. "
        #         "Set `override_existing_dataflow=True` to override it."
        #     )
        # self.output_file = output_dataflow

        # Handling an initial dataflow file.
        self._graph = None
        if input_dataflow is not None:
            self._graph = self._load_dataflow_graph_from_file()

        # Handle a specification file.
        self._specification = self._load_specification(specification)

    def _load_specification(self, specification_path: Path):
        success, reason = is_proper_input_file(specification_path)
        if not success:
            raise ValueError(f"Invalid `specification_path`: {reason}")
        with open(specification_path, mode="rt", encoding="utf-8") as fd:
            return json.loads(fd.read())

    def load_dataflow_graph(
        self,
        graph: Tuple[Path | str | DataflowGraph],
    ) -> DataflowGraph:
        if isinstance(graph, DataflowGraph):
            self.validate_graph(graph)
            self._graph = graph
            return self._graph

        elif isinstance(graph, str):
            graph_file = Path(graph)
            _graph = self._load_dataflow_graph_from_file(graph_file)
            return _graph

        elif isinstance(self, Path):
            graph_file = graph
            _graph = self._load_dataflow_graph_from_file(graph_file)
            _graph.validate()
            return _graph

    def create_graph(self) -> DataflowGraph:
        self._graph = DataflowGraph(self._specification)
        return self._graph

    def _load_dataflow_graph_from_file(self, path: Path) -> DataflowGraph:
        path = path.resolve()
        with open(path, "rt", encoding="utf-8") as fd:
            graph_as_text = fd.read()
            graph = json.loads(graph_as_text)
            return DataflowGraph(
                dataflow=graph, specification=self._specification
            )
