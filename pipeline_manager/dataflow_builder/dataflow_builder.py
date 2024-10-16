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
        dataflow_path: Union[Path, str],
        specification_path: Union[Path, str],
        override_existing_dataflow: bool = False,
    ) -> None:
        """Initialise class attribute, perform basic checks."""
        # Handling a dataflow file.
        if isinstance(dataflow_path, str):
            dataflow_path = Path(dataflow_path)

        dataflow_path = dataflow_path.resolve()
        if dataflow_path.exists() and not override_existing_dataflow:
            raise FileExistsError(
                f"Specification file {dataflow_path} already exists. "
                "Set `override_existing_dataflow=True` to override it."
            )

        # Handle a specification file.
        success, reason = is_proper_input_file(specification_path)
        if not success:
            raise ValueError(f"Invalid `specification_path`: {reason}")
        self._load_specification(specification_path)

        self._graph = None
        self.output_file = dataflow_path

    def _load_specification(self, specification_path: Path) -> None:
        self._specification = None
        with open(specification_path, mode="rt", encoding="utf-8") as fd:
            self._specification = json.loads(fd.read())

        if not self._specification:
            raise ValueError(
                "Specification cannot be empty. "
                f"Currently: {self._specification}"
            )

    def load_dataflow_graph(
        self, graph: Tuple[Path | str | DataflowGraph]
    ) -> DataflowGraph:
        if isinstance(graph, DataflowGraph):
            # FIXME: Validate the graph before loading it.
            self._graph = graph
            return self._graph

        elif isinstance(graph, str):
            # FIXME: Validate the graph before loading it.
            graph_file = Path(graph)
            self._load_from_file(graph)

        elif isinstance(self, Path):
            # FIXME: Validate the graph before loading it.
            graph_file = graph
            self._load_from_file(graph_file)

        # FIXME: Validate the graph before loading it.

    def create_graph(self) -> DataflowGraph:
        self._graph = DataflowGraph(self._specification)
        return self._graph
