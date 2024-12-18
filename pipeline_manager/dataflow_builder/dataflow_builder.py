"""Module for building the dataflow graphs."""

import json
import os
import tempfile
from pathlib import Path
from typing import Dict, List, Union

from pipeline_manager.dataflow_builder.dataflow_graph import DataflowGraph
from pipeline_manager.dataflow_builder.entities import convert_output
from pipeline_manager.dataflow_builder.utils import (
    get_uuid,
    is_proper_input_file,
)
from pipeline_manager.specification_builder import SpecificationBuilder
from pipeline_manager.validator import validate


class GraphBuilder:
    """
    Class for building dataflow graphs.

    Each instance of the GraphBuilder must be associated with a single
    specification to ensure proper validation.
    """

    def __init__(
        self, specification: Path, specification_version: str
    ) -> None:
        """
        Load a specification from a file, initialise an empty list of graphs.

        Parameters
        ----------
        specification : Path
            Path to a JSON specification file.
        specification_version: str
            Version of the specification.
        """
        self.specification_version = specification_version
        self.load_specification(specification)
        self.graphs: List[DataflowGraph] = []

    def load_graphs(self, dataflow_path: Path):
        """
        Load all dataflow graphs from a file.

        Parameters
        ----------
        dataflow_path : Path
            Path to a dataflow graph.

        Raises
        ------
        ValueError
            Raised if a dataflow graph could not be loaded.
        """
        success, reason = is_proper_input_file(
            dataflow_path, intended_use="dataflow"
        )
        if not success:
            raise ValueError(f"Invalid `dataflow_path`: {reason}")
        with open(dataflow_path, encoding="utf-8") as fd:
            content = json.load(fd)

            for graph in content["graphs"]:
                dataflow_graph = DataflowGraph(
                    builder_with_spec=self._spec_builder,
                    dataflow=graph,
                )
                self.graphs.append(dataflow_graph)

            self.validate()

    def load_specification(
        self, specification_path: Path, purge_old_graphs: bool = True
    ):
        """
        Load a specification from a file to use in GraphBuilder.

        The default behaviour is to remove loaded dataflow graphs when loading
        a new specification. That is due to the fact that a dataflow graph
        is closely linked with its specification. Notice that loading a
        specification overrides the old one.

        Parameters
        ----------
        specification_path : Path
            Path to a specification file.
        purge_old_graphs : bool, optional
            Determine if dataflow graphs loaded to memory should be purged.
            It makes sense as after changing a specification dataflow graphs
            may no longer be valid. By default True.

        Raises
        ------
        ValueError
            Raised if specification file cannot be loaded or is invalid.
        """
        self._spec_builder = SpecificationBuilder(
            spec_version=self.specification_version
        )

        success, reason = is_proper_input_file(specification_path)
        if not success:
            raise ValueError(f"Invalid `specification_path`: {reason}")
        with open(specification_path, mode="rt", encoding="utf-8") as fd:
            specification = json.load(fd)
            self._spec_builder.update_spec_from_other(specification)

            if purge_old_graphs:
                self.graphs = []

    def create_graph(
        self, based_on: Union[Path, str, DataflowGraph, None] = None
    ) -> DataflowGraph:
        """
        Create a dataflow graph and return its instance.

        Create an instance of a dataflow graph, add it to the internal
        list and return it. The dataflow graph is based on the graph
        provided in `based_on` parameter.

        Parameters
        ----------
        based_on : Union[Path, str, DataflowGraph, None], optional
            Dataflow graph, on which the new graph should be based on.
            When `Path` or `str`, it should be a path to dataflow graph in
            a JSON format. When `DataflowGraph`, it should be a valid
            representation. When `None`, the new dataflow graph will not
            be based on anything, by default None.

        Returns
        -------
        DataflowGraph
            Instance a of a dataflow graph, preserved in the GraphBuilder.
        """
        if based_on is not None:
            if isinstance(based_on, DataflowGraph):
                self.graphs.append(based_on)
            else:
                self.graphs.append(self._load_dataflow_graph_from_file())

        self.graphs.append(DataflowGraph(self._spec_builder))
        return self.graphs[-1]

    def _load_dataflow_graph_from_file(self, path: Path) -> DataflowGraph:
        path = path.resolve()
        with open(path, encoding="utf-8") as fd:
            graph = json.load(fd)
            dataflow_graph = DataflowGraph(
                dataflow=graph, builder_with_spec=self._spec_builder
            )

            return dataflow_graph

    def save(self, json_file: Path):
        """
        Save graphs to a JSON file.

        Parameters
        ----------
        json_file : Path
            Path, where an output JSON file will be created.
        """
        with open(json_file, "wt", encoding="utf-8") as fd:
            fd.write(self.to_json(as_str=True))
        self.validate()

    def validate(self):
        """
        Validate the entire dataflow file including all the included graphs.

        Raises
        ------
        ValueError
            Raised if an external validator failed to validate
            either a dataflow or specification file.
        """
        # Save a dataflow graph to a temporary file.
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_dataflow_file = Path(tmpdir) / "spec.json"
            with open(temp_dataflow_file, "wt", encoding="utf-8") as fd:
                fd.write(self.to_json(as_str=True))

        # `self.save()` cannot be used as it saves the dataflow only.
        temp_specification_file = Path(f"temp_specification_{get_uuid()}.json")

        with open(temp_specification_file, "wt", encoding="utf-8") as fd:
            specification = self._spec_builder._construct_specification(
                sort_spec=False
            )
            json.dump(specification, fd, ensure_ascii=False)

        result = validate(
            dataflow_paths=[temp_dataflow_file],
            specification_path=temp_specification_file,
        )

        os.remove(temp_dataflow_file)
        os.remove(temp_specification_file)

        message = ""
        if result == 1:
            message = "The provided specification is invalid."
        elif result == 2:
            message = "The generated dataflow is invalid."
        elif result == 3:
            message = "Input was invalid."
        if message:
            raise ValueError(message)

    def to_json(self, as_str: bool = True) -> Union[Dict, str]:
        output = {
            "version": "20240723.13",
            "graphs": [graph.to_json(as_str=False) for graph in self.graphs],
        }

        return convert_output(output, as_str)
