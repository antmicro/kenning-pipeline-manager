"""Module with DataflowBuilder class, sharing its API publicly."""

import json
import os
from pathlib import Path
from typing import Dict, List, Union

from pipeline_manager.dataflow_builder.dataflow_graph import DataflowGraph
from pipeline_manager.dataflow_builder.utils import (
    get_uuid,
    is_proper_input_file,
)
from pipeline_manager.validator import validate


class DataflowBuilder:
    """
    Class for building dataflow graphs,
    each instance of the class must be associated with a single specification.
    """

    def __init__(
        self,
        specification: Path,
    ) -> None:
        """
        Load a specification from a file, initialise an empty list of graphs.

        Parameters
        ----------
        specification : Path
            Path to a JSON specification file.
        """
        self.load_specification(specification)
        self.graphs: List[DataflowGraph] = []

    def load_graphs(self, dataflow_path: Path):
        """
        Load a dataflow graph from a file.

        The graph is loaded to the internal storage and returned to
        facilitate further manipulations. The first graph from a
        file is loaded.

        Parameters
        ----------
        dataflow_path : Path
            Path a dataflow graph.

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
        with open(dataflow_path, "rt", encoding="utf-8") as fd:
            content = json.loads(fd.read(), ensure_ascii=False)
            for graph in content["graphs"]:
                dataflow_graph = DataflowGraph(
                    specification=self._specification,
                    dataflow=graph,
                )

                self.graphs.append(dataflow_graph)

    def load_specification(
        self, specification_path: Path, purge_dataflows: bool = True
    ):
        """
        Replace a current specification file associated
        with the instance of DataflowBuilder.

        Parameters
        ----------
        specification_path : Path
            Path to a specification file.
        purge_dataflows : bool, optional
            Determine if dataflow graphs loaded to memory should be purged.
            It makes sense as after changing a specification dataflow graphs
            may no longer be valid. By default True.

        Raises
        ------
        ValueError
            Raised if specification file cannot be loaded or is invalid.
        """
        success, reason = is_proper_input_file(specification_path)
        if not success:
            raise ValueError(f"Invalid `specification_path`: {reason}")
        with open(specification_path, mode="rt", encoding="utf-8") as fd:
            self._specification = json.loads(fd.read())

            if purge_dataflows:
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
            Instance a of a dataflow graph, preserved in the DataflowBuilder.
        """
        if based_on is not None:
            if isinstance(based_on, DataflowGraph):
                self.graphs.append(based_on)
            else:
                self.graphs.append(self._load_dataflow_graph_from_file())

        self.graphs.append(DataflowGraph(self._specification))
        return self.graphs[-1]

    def _load_dataflow_graph_from_file(self, path: Path) -> DataflowGraph:
        path = path.resolve()
        with open(path, "rt", encoding="utf-8") as fd:
            graph_as_text = fd.read()
            graph = json.loads(graph_as_text)
            dataflow_graph = DataflowGraph(
                dataflow=graph, specification=self._specification
            )

            return dataflow_graph

    def save(self, output_file: Path, safe_mode: bool = True):
        """
        Save graphs to a JSON file.

        Parameters
        ----------
        output_file : Path
            Path to an output JSON file. File may not exist.
        safe_mode : bool
            In safe mode, a dataflow is validated before being saved.
        """
        if safe_mode:
            self.validate()
        with open(output_file, "wt", encoding="utf-8") as fd:
            fd.write(self.to_json(as_str=True))

    def validate(self):
        # Sava dataflow to a temp file.
        # Enabling safe mode here would lead to infinite circular recursion.
        temp_dataflow_file = Path(f"temp_dataflow_{get_uuid()}.json")
        self.save(output_file=temp_dataflow_file, safe_mode=False)

        # `self.save()` cannot be used as it saves the dataflow only.
        temp_specification_file = Path(f"temp_specification_{get_uuid()}.json")
        with open(temp_specification_file, "wt", encoding="utf-8") as fd:
            specification = json.dumps(self._specification)
            fd.write(specification)

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

        if as_str:
            return json.dumps(output)
        return output
