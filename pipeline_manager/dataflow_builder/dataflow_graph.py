"""Module with DataflowGraph class for representing a dataflow graph."""

import json
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pipeline_manager.dataflow_builder.entities import (
    Direction,
    Interface,
    InterfaceConnection,
    JsonConvertible,
    Node,
    Property,
    Vector2,
)
from pipeline_manager.dataflow_builder.utils import (
    ensure_connection_is_absent,
    get_interface_if_present,
    get_uuid,
)


class AttributeType(Enum):
    """
    Available types of attributes that may be obtained with
    the `DataflowGraph.get` method.
    """

    NODE = "_nodes"
    CONNECTION = "_connections"


class DataflowGraph(JsonConvertible):
    """Representation of a dataflow graph."""

    def __init__(
        self,
        specification: Dict[str, Any],
        dataflow: Optional[Dict[str, Any]] = None,
    ):
        """Initialise a dataflow graph with default, mostly empty, values."""
        self._id = get_uuid()
        self._nodes: Dict[str, Node] = {}
        self._connections: Dict[str, InterfaceConnection] = {}
        self._specification: Dict[str, Any] = specification

        if dataflow:
            self._nodes = dataflow["nodes"]
            self._connections = dataflow["connections"]

    def create_node(self, **kwargs: Dict[str, Any]) -> Node:
        """
        Create the node initialized with the supplied arguments.

        The use of this method is highly preferred to manually adding a node.
        Default values are taken from the specification so remember to pass
        `name` of the node. The default values may be overridden by the values
        supplied in `kwargs`. `id` is already initialized.

        Parameters
        ----------
        **kwargs : Dict[str, Any]
            Keyword arguments to initialise a newly created node.
            Check attributes of `Node` dataclass, to find all available keys.

        Returns
        -------
        Node
            The initialized node that belongs to the dataflow graph.

        Raises
        ------
        ValueError
            Raised if `name` key is missing in the `kwargs` directory
            or the provided name of the node does not exists in the
            specification.
        """
        if "name" not in kwargs:
            raise ValueError(
                "Missing parameter `name`, which is required "
                "to create new node."
            )

        base_node = None
        for _node in self._specification["nodes"]:
            # Not a node but a category.
            if "name" not in _node:
                continue
            if kwargs["name"] == _node["name"]:
                base_node = _node

        if not base_node:
            raise ValueError(
                f"Provided name of the node `{kwargs["name"]}` "
                "is missing in the specification."
            )

        node_id = get_uuid()

        # Values for interface initialization are taken from the specification.
        interfaces = []
        for interface in base_node["interfaces"]:
            _interface = Interface(
                id=get_uuid(),
                name=interface["name"],
                direction=Direction(interface["direction"]),
            )
            interfaces.append(_interface)

        # Values for properties initialization are taken
        # from the specification.
        properties = []
        if "properties" in base_node:
            for prop in base_node["properties"]:
                _property = Property(
                    name=prop["name"],
                    value=prop["default"],
                )
                properties.append(_property)

        DEFAULT_WIDTH = 200
        parameters = {
            "specification": self._specification,
            "id": node_id,
            "name": base_node["name"],
            "width": getattr(base_node, "width", DEFAULT_WIDTH),
            "enabled_interface_groups": [],
            "instance_name": None,
            "interfaces": interfaces,
            "position": Vector2(0, 0),
            "properties": properties,
            "subgraph": None,
            "two_column": self._specification["metadata"]["twoColumn"],
        }

        # Override the default parameters with `kwargs`.
        for key, value in kwargs.items():
            parameters[key] = value

        self._nodes[node_id] = Node(**parameters)
        return self._nodes[node_id]

    def create_connection(
        self,
        from_interface: Union[Interface, str],
        to_interface: Union[Interface, str],
    ) -> InterfaceConnection:
        """
        Create a connection between two existing interfaces.

        The function performs numerous checks to verify validity
        of the desired connection, including if the connection already exists,
        interfaces' types are matching and so on. The connection is added,
        given it has passed these checks.

        Parameters
        ----------
        from_interface : Union[Interface, str]
            Source interface, where data will flow from.
        to_interface : Union[Interface, str]
            Destination interface, where data will flow to.

        Returns
        -------
        InterfaceConnection
            Created connection added to the graph.

        Raises
        ------
        ValueError
            Raised if source interface does not belong to the graph.
        ValueError
            Raised if destination interface does not belong to the graph.
        ValueError
            Raised if source interface direction is `input`.
        ValueError
            Raised if destination interface direction is `output`.
        ValueError
            Raised if a mismatch between source and destination interfaces'
                types occurs.
        """
        from_interface = get_interface_if_present(from_interface, self._nodes)
        to_interface = get_interface_if_present(to_interface, self._nodes)

        if from_interface is None:
            raise ValueError(
                "Source interface is "
                "not present in the dataflow graph."
                f"{from_interface}"
            )

        if to_interface is None:
            raise ValueError(
                "Destination (drain) interface is "
                "not present in the dataflow graph."
                f"{to_interface}. Aborted creation a connection."
            )

        if from_interface.direction == Direction.INPUT:
            raise ValueError(
                "Direction of the `from` interface cannot be `input`."
                "Aborted creating a connection."
            )

        if to_interface.direction == Direction.OUTPUT:
            raise ValueError(
                "Direction of the `to` interface cannot be `output`."
                "Aborted creation a connection."
            )

        if from_interface.type != to_interface.type:
            raise ValueError(
                "Mismatch between `from` interface with type = "
                f"{from_interface.type} and `to` interface with type = "
                f"{to_interface.type}."
            )

        connection_id = get_uuid()
        connection = InterfaceConnection(
            id=connection_id,
            from_interface=from_interface,
            to_interface=to_interface,
        )

        ensure_connection_is_absent(
            connection=connection,
            connections=self._connections,
        )

        self._connections[connection_id] = connection
        return self._connections[connection_id]

    def to_json(self, as_str: bool = True) -> Union[str, Dict]:
        nodes = [node.to_json(as_str=False) for _, node in self._nodes.items()]
        connections = [
            conn.to_json(as_str=False) for _, conn in self._connections.items()
        ]

        output = {"id": self._id, "nodes": nodes, "connections": connections}

        if as_str:
            return json.dumps(output)
        return output

    def get(
        self, type: AttributeType, **kwargs
    ) -> Union[List[Node], List[InterfaceConnection]]:
        """
        Get items of a given type, which satisfy all the desired criteria.

        Items are understood as either nodes or connections.
        The function finds objects by eliminating these, which do not
        match the criteria. Thus, between all the criteria
        is `AND` logical operator.

        Parameters
        ----------
        type : AttributeType
            Type of the output objects.
        **kwargs
            Search criteria. Available:
            - Keys: the attributes of the object of he chosen type.
            - Values: values to be matched.

        Returns
        -------
        Union[List[Node], List[InterfaceConnection]]
            List of items satisfying the criteria.
        """
        # Choose an appropriate dictionary.
        items: Dict = getattr(self, type.value)
        items_satisfying_criteria = list(items.values())

        # Match criteria.
        for search_key, desired_value in kwargs.items():
            items_satisfying_criteria = [
                item
                for item in items_satisfying_criteria
                if getattr(item, search_key) == desired_value
            ]

        return items_satisfying_criteria

    def get_by_id(
        self, type: AttributeType, id: str
    ) -> Optional[Union[InterfaceConnection, Node]]:
        """
        Fast getter, which finds an item of a supplied type and
        with the provided id.

        It has complexity of O(1) in juxtaposition to the `get` method, which
        iterates over all items.

        Parameters
        ----------
        type : AttributeType
            Type of the output objects.
        id : str
            ID of the sought object.

        Returns
        -------
        Optional[Union[InterfaceConnection, Node]]
            Either an instance of InterfaceConnection or Node depending
            on the provided `type`. If does not exist, None is returned.
        """
        items: Dict = getattr(self, type.value)
        return items.get(id, None)
