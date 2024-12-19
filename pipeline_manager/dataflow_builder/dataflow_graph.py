"""Module with DataflowGraph class for representing a dataflow graph."""

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
    camel_case_to_snake_case,
    convert_output,
    match_criteria,
)
from pipeline_manager.dataflow_builder.utils import (
    ensure_connection_is_absent,
    get_interface_if_present,
    get_uuid,
)
from pipeline_manager.specification_builder import SpecificationBuilder


class AttributeType(Enum):
    """
    Available types of attributes that may be obtained with
    the `DataflowGraph.get` method.
    """

    NODE = "_nodes"
    CONNECTION = "_connections"
    INTERFACE = "interfaces"


class DataflowGraph(JsonConvertible):
    """Representation of a dataflow graph."""

    def __init__(
        self,
        builder_with_spec: SpecificationBuilder,
        dataflow: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialise a dataflow graph with values either taken from the supplied
        dataflow graph or empty ones.

        Do not use the constructor directly.
        Use `GraphBuilder.create_graph`, instead.

        Parameters
        ----------
        builder_with_spec : SpecificationBuilder
            Specification builder instance with specification file loaded.
        dataflow : Optional[Dict[str, Any]], optional
            Content of a dataflow builder to load,
            None means an empty dataflow graph, by default None.
        """
        self._id = (
            dataflow["id"] if dataflow and "id" in dataflow else get_uuid()
        )
        self._nodes: Dict[str, Node] = {}
        self._connections: Dict[str, InterfaceConnection] = {}
        self._spec_builder = builder_with_spec

        if dataflow is None:
            return

        for node in dataflow["nodes"]:
            node_arguments = {
                camel_case_to_snake_case(key): value
                for key, value in node.items()
            }
            node_arguments["position"] = Vector2(
                node_arguments["position"]["x"],
                node_arguments["position"]["y"],
            )

            self._nodes[node["id"]] = Node(
                specification_builder=self._spec_builder,
                **node_arguments,
            )

        for connection in dataflow["connections"]:
            self._connections[connection["id"]] = InterfaceConnection(
                id=connection["id"],
                from_interface=self.get_by_id(
                    AttributeType.INTERFACE, connection["from"]
                ),
                to_interface=self.get_by_id(
                    AttributeType.INTERFACE, connection["to"]
                ),
            )

    def create_node(self, name: str, **kwargs) -> Node:
        """

        Create the node initialized with the supplied arguments.

        Use this method instead of manually adding a node.
        Default values are taken from the specification, based on the
        provided `name` parameter. The default values may be overridden by
        the values supplied in `kwargs`. `id` is already initialized.

        Parameters
        ----------
        name: str
            Name of a node, based on which default values will be derived.
        kwargs
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
        base_node = None

        for _node in self._spec_builder._get_nodes(sort_spec=False):
            # Not a node but a category.
            if "name" not in _node:
                continue
            if name == _node["name"]:
                base_node = _node

        if not base_node:
            node_name = name
            raise ValueError(
                f"Provided name of the node `{node_name}` "
                "is missing in the specification."
            )

        node_id = base_node["id"] if "id" in base_node else get_uuid()

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
            "specification_builder": self._spec_builder,
            "id": node_id,
            "name": base_node["name"],
            "width": getattr(base_node, "width", DEFAULT_WIDTH),
            "enabled_interface_groups": [],
            "instance_name": None,
            "interfaces": interfaces,
            "position": Vector2(0, 0),
            "properties": properties,
            "subgraph": None,
            "two_column": self._spec_builder._metadata["twoColumn"],
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
        connection_id: Optional[str] = None,
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
        connection_id : Optional[str]
            Identifier of a connection. If not supplied,
            one will be generated.

        Returns
        -------
        InterfaceConnection
            Created connection added to the graph.

        Raises
        ------
        ValueError
            Raised if:
            - a source interface does not belong to the graph.
            - a destination interface does not belong to the graph.
            - a source interface direction is `input`.
            - a destination interface direction is `output`.
            - a mismatch between source and destination interfaces'
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

        if not connection_id:
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
        return convert_output(output, as_str)

    def get(
        self, type: AttributeType, **kwargs
    ) -> Union[List[Node], List[InterfaceConnection], List[Interface]]:
        """

        Get items of a given type, which satisfy all the desired criteria.

        Items are understood as either nodes or connections or interfaces.
        The function finds objects by eliminating these, which do not
        match the criteria. Thus, between all the criteria
        is `AND` logical operator.


        Parameters
        ----------
        type : AttributeType
            Type of the output objects.
        kwargs
            Contains search criteria. Available:
            - Keys: the attributes of the object of he chosen type.
            - Values: values to be matched.

        Returns
        -------
        Union[List[Node], List[InterfaceConnection], List[Interface]]
            List of items satisfying the criteria.
        """
        # Although interfaces belong to the nodes, not to a graph.
        # The option to find them is kept here so the API is coherent.
        if type == AttributeType.INTERFACE:
            return self._get_interfaces(**kwargs)

        # Choose an appropriate dictionary as data source.
        items: Dict = getattr(self, type.value)
        items_satisfying_criteria = list(items.values())

        return match_criteria(items=items_satisfying_criteria, **kwargs)

    def _get_interfaces(self, **kwargs) -> List[Interface]:
        interfaces: List[Interface] = []
        for _, node in self._nodes.items():
            interfaces.extend(node.interfaces)

        return match_criteria(items=interfaces, **kwargs)

    def get_by_id(
        self, type: AttributeType, id: str
    ) -> Optional[Union[InterfaceConnection, Node, Interface]]:
        """
        Fast getter, which finds an item of a supplied type and
        with the provided id.

        It has complexity of O(1) (except for interfaces) in juxtaposition
        to the `get` method, which iterates over all items.

        Parameters
        ----------
        type : AttributeType
            Type of the output objects.
        id : str
            ID of the sought object.

        Returns
        -------
        Optional[Union[InterfaceConnection, Node, Interface]]
            Either an single instance of InterfaceConnection or Node
            or Interface depending on the provided `type`.
            If does not exist, None is returned.
        """
        if type == AttributeType.INTERFACE:
            interface = self._get_interfaces(id=id)
            return interface[0] if interface else None
        items: Dict = getattr(self, type.value)
        return items.get(id, None)
