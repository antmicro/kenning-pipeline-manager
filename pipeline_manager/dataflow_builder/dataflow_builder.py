# Copyright (c) 2024-2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""Module for building the dataflow graphs."""

import copy
import json
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from typing_extensions import override

from pipeline_manager.dataflow_builder.dataflow_graph import DataflowGraph
from pipeline_manager.dataflow_builder.entities import convert_output, get_uuid
from pipeline_manager.dataflow_builder.utils import (
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
        self,
        specification: Union[Path, str, Dict],
        specification_version: str,
        workspace_directory: Optional[Path] = None,
    ) -> None:
        """
        Load a specification from a file, initialise an empty list of graphs.

        Parameters
        ----------
        specification : Union[Path, str, Dict]
            Path to a JSON specification file or Dict with its representation
        specification_version: str
            Version of the specification.
        workspace_directory: Optional[Path]
            Path to the Pipeline Manager's workspace directory
        """
        self.specification_version = specification_version
        self.workspace_directory = workspace_directory
        self.load_specification(specification)
        self.graphs: List[DataflowGraph] = []
        self.entry_graph = None

    def load_graphs(self, dataflow_source: Union[Path, str, Dict]):
        """
        Load all dataflow graphs from a file.

        Parameters
        ----------
        dataflow_source : Union[Path, str, Dict]
            Path to a dataflow graph or dataflow graph dictionary

        Raises
        ------
        ValueError
            Raised if a dataflow graph could not be loaded.
        """
        if isinstance(dataflow_source, (Path, str)):
            dataflow_path = dataflow_source
            success, reason = is_proper_input_file(
                dataflow_path, intended_use="dataflow"
            )
            if not success:
                raise ValueError(f"Invalid `dataflow_path`: {reason}")
            with open(dataflow_path, encoding="utf-8") as fd:
                content = json.load(fd)
        else:
            content = dataflow_source

        for graph in content["graphs"]:
            dataflow_graph = DataflowGraph(
                builder_with_spec=self._spec_builder,
                builder_with_dataflow=self,
                dataflow=graph,
            )
            self.graphs.append(dataflow_graph)
        if len(self.graphs) < 1:
            raise ValueError(
                f"After loading graphs from the dataflow file "
                f"`{dataflow_path.expanduser().resolve()}`, "
                "GraphBuilder is empty."
            )

        if "entryGraph" in content:
            entry_graph_id = content["entryGraph"]
            self.entry_graph = self.get_graph_by_property("id", entry_graph_id)
        else:
            self.entry_graph = self.graphs[0]

        self.validate()

    def load_specification(
        self,
        specification: Union[Path, str, Dict],
        purge_old_graphs: bool = True,
    ):
        """
        Load a specification from given file or dictionary
        to use in GraphBuilder.

        The default behaviour is to remove loaded dataflow graphs when loading
        a new specification. That is due to the fact that a dataflow graph
        is closely linked with its specification. Notice that loading a
        specification overrides the old one.

        Parameters
        ----------
        specification : Union[Path, str, Dict]
            Path to specification file or specification dictionary
        purge_old_graphs : bool, optional
            Determine if dataflow graphs loaded to memory should be purged.
            It makes sense as after changing a specification dataflow graphs
            may no longer be valid. By default True.

        Raises
        ------
        ValueError
            Raised if specification cannot be loaded or its file is invalid.
        """
        self.specification_file = specification
        self._spec_builder = SpecificationBuilder(
            spec_version=self.specification_version
        )

        if isinstance(specification, (Path, str)):
            self.specification_file = specification
            self.specification = None

            success, reason = is_proper_input_file(self.specification_file)
            if not success:
                raise ValueError(f"Invalid `specification_path`: {reason}")
            with open(self.specification_file, encoding="utf-8") as fd:
                specification = json.load(fd)
        else:
            self.specification_file = None
            self.specification = specification
        self._spec_builder.update_spec_from_other(specification)

        if purge_old_graphs:
            self.graphs = []
            self.entry_graph = None

    def create_graph(
        self,
        based_on: Union[Path, str, DataflowGraph, Dict, None] = None,
        identifier: Optional[str] = None,
    ) -> DataflowGraph:
        """
        Create a dataflow graph and return its instance.

        Create an instance of a dataflow graph, add it to the internal
        list and return it. The dataflow graph is based on the graph
        provided in `based_on` parameter.

        Parameters
        ----------
        based_on : Union[Path, str, DataflowGraph, Dict, None], optional
            Dataflow graph, on which the new graph should be based on.
            When `Path` or `str`, it should be a path to dataflow file in
            a JSON format. When `Dict`, it should be a dictionary
            representation of the dataflow. When `DataflowGraph`, it
            should be a valid representation (as its deep copy will be
            added). When `None`, the new dataflow graph will not
            be based on anything, by default None.
        identifier : Optional[str]
            Either `id` or `name` of a dataflow graph.
            That identifier should uniquely identify a graph
            from the dataflow file provided in `based_on` argument.
            If `based_on` is either `None` or of type `DataflowGraph`,
            the value of `identifier` is not used.
            Defaults to the graph defined as `entryGraph`
            in the dataflow file.

        Returns
        -------
        DataflowGraph
            Instance a of a dataflow graph, preserved in the GraphBuilder.
        """
        if based_on is None:
            self.graphs.append(DataflowGraph(self._spec_builder, self))
            return self.graphs[-1]
        elif isinstance(based_on, DataflowGraph):
            graph_copy = copy.deepcopy(based_on)
            self.graphs.append(graph_copy)
        else:
            self.graphs.append(
                self._load_graph_from_dataflow_source(based_on, identifier)
            )

        self.graphs.append(DataflowGraph(self._spec_builder, self))
        return self.graphs[-1]

    def _load_graph_from_dataflow_source(
        self, source: Union[Path, str, Dict], identifier: Optional[str]
    ) -> DataflowGraph:
        if isinstance(source, (str, Path)):
            source = Path(source).resolve()

        another_builder = GraphBuilder(
            specification_version=self.specification_version,
            specification=self.specification
            if self.specification is not None
            else self.specification_file,
            workspace_directory=self.workspace_directory,
        )

        another_builder.load_graphs(dataflow_source=source)

        if identifier is None:
            return another_builder.entry_graph

        try:
            return another_builder.get_graph_by_property("id", identifier)
        except ValueError:
            try:
                return another_builder.get_graph_by_property(
                    "name", identifier
                )
            except ValueError:
                raise ValueError(
                    f"The provided `identifier` = `{identifier}` "
                    "matches neither `id` nor `name` of any graph."
                )

    def get_graph_by_property(
        self, property_name: str, property_value: Any
    ) -> DataflowGraph:
        """
        Get the first graph with `property_name` equal to `property_value`.

        Parameters
        ----------
        property_name: str
            Name of the property, e.g.: `id` or `name`.
        property_value: Any
            Exact value to be matched.

        Returns
        -------
        DataflowGraph
            Dataflow graph satisfying the provided criteria.

        Raises
        ------
        ValueError
            Raised if the provided property name and
            values does not match any graph.
        """
        for graph in self.graphs:
            if not hasattr(graph, property_name):
                raise TypeError(
                    "DataflowGraph does not have "
                    f"the property named `{property_name}`."
                )
            if getattr(graph, property_name) != property_value:
                continue
            return graph

        raise ValueError(
            f"Pair `{property_name}` = `{property_value}` should "
            "be associated with at least one graph. However, the pair "
            "does not match any graph."
        )

    def _load_graph_from_dataflow_file(
        self, path: Union[Path, str], identifier: Optional[str]
    ) -> DataflowGraph:
        path = Path(path).resolve()

        another_builder = GraphBuilder(
            specification_version=self.specification_version,
            specification=self.specification_file,
            workspace_directory=self.workspace_directory,
        )
        path = another_builder.load_graphs(dataflow_path=path)

        if identifier is None:
            return another_builder.entry_graph

        try:
            return another_builder.get_graph_by_property("id", identifier)
        except ValueError:
            try:
                return another_builder.get_graph_by_property(
                    "name", identifier
                )
            except ValueError:
                raise ValueError(
                    f"The provided `identifier` = `{identifier}` "
                    "matches neither `id` nor `name` of any graph."
                )

    def get_graph_by_id(self, id: str) -> DataflowGraph:
        """
        Get a graph by its ID.

        Parameters
        ----------
        id : str
            ID of the graph to retrieve.

        Returns
        -------
        DataflowGraph
            Dataflow graph with the provided ID.

        Raises
        ------
        ValueError
            Raised if the provided ID does not match any graph
            or matches more than one graph.
        """
        matching_graphs = [graph for graph in self.graphs if graph._id == id]
        if len(matching_graphs) != 1:
            raise ValueError(
                "The ID of a graph should be associated with exactly one graph"
                " but the provided `id` matches "
                f"{len(matching_graphs)} graphs."
            )

        [subgraph] = matching_graphs
        return subgraph

    def get_subgraphs(self) -> List[DataflowGraph]:
        """
        Get a list of subgraphs.

        Get a list of graphs, which are contained in some node,
        what makes them subgraphs.

        Returns
        -------
        List[DataflowGraph]
            A list of subgraphs.
        """
        subgraphs: List[DataflowGraph] = []
        for graph in self.graphs:
            for node in graph._nodes.values():
                if node.subgraph is None:
                    continue
                subgraphs.append(self.get_graph_by_id(node.subgraph))

        return subgraphs

    def get_subgraph_by_name(self, name: str) -> DataflowGraph:
        """
        Get a subgraph by the name.

        Get subgraph by either the name of a subgraph or
        name of the node containing the subgraph.

        Parameters
        ----------
        name : str
            Either name of the subgraph or
            name of the node containing the subgraph.

        Returns
        -------
        DataflowGraph
            An instance of DataflowGraph matching by `name`.

        Raises
        ------
        ValueError
            Raised if name matches to more than one or none of graphs.
        """
        subgraphs = self.get_subgraphs()
        subgraphs_by_graph_name = [
            graph
            for graph in subgraphs
            if graph.name is not None and graph.name == name
        ]

        subgraphs_by_node_name = [
            self.get_graph_by_id(node.subgraph)
            for graph in self.graphs
            for node in graph._nodes.values()
            if node.subgraph is not None and node.name == name
        ]

        matching_subgraphs = list(
            {
                *subgraphs_by_graph_name,
                *subgraphs_by_node_name,
            }
        )
        if len(matching_subgraphs) != 1:
            raise ValueError(
                "The name should be associated with exactly one graph"
                " but the provided `name` matches "
                f"{len(matching_subgraphs)} graphs."
            )

        [subgraph] = matching_subgraphs
        return subgraph

    def save(self, json_file: Path):
        """
        Save graphs to a JSON file.

        Saving also validates all the stored graphs.

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
        RuntimeError
            Raised if an external validator failed to validate
            either a dataflow or specification file. An error
            message is provided by the external validator.
        """
        # Save a dataflow graph to a temporary file.
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_dataflow_file = Path(tmpdir) / "spec.json"
            with open(temp_dataflow_file, "wt", encoding="utf-8") as fd:
                fd.write(self.to_json(as_str=True))

            # `self.save()` cannot be used as it saves the dataflow only.
            temp_specification_file = Path(tmpdir) / (
                f"temp_specification_{get_uuid()}.json"
            )

            with open(temp_specification_file, "wt", encoding="utf-8") as fd:
                specification = self._spec_builder._construct_specification(
                    sort_spec=False
                )
                json.dump(specification, fd, ensure_ascii=False)

            result = validate(
                dataflow_paths=[temp_dataflow_file],
                specification_path=temp_specification_file,
                workspace_directory=self.workspace_directory,
            )

        if result:
            raise RuntimeError(
                "An external validator failed. An error message has been "
                "provided by the validator."
            )

    @override
    def to_json(self, as_str: bool = True) -> Union[Dict, str]:
        output = {
            "version": self.specification_version,
            "graphs": [graph.to_json(as_str=False) for graph in self.graphs],
        }

        return convert_output(output, as_str)
