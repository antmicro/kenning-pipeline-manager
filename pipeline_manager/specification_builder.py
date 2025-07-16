# Copyright (c) 2020-2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Module for constructing the specification for the Pipeline Manager.

Can be used by other applications to quickly form the specification
for the Pipeline Manager server.
"""

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import requests
from urllib3.exceptions import (
    ConnectTimeoutError,
    MaxRetryError,
    ReadTimeoutError,
)

from pipeline_manager.dataflow_builder.data_structures import Direction, Side
from pipeline_manager.validator import validate

Style = Union[str, List[str]]


class SpecificationBuilderException(Exception):
    """
    Is raised when any inconsistency in the specification generation
    is spotted.
    """

    pass


class MissingInterfaceAttribute(Exception):
    """Exception raised if an interface is missing an obligatory attribute."""


def get_optional(
    entry: Optional[Dict], key: Optional[Any] = None
) -> Optional[Any]:
    """
    Returns the optional field if it is present.

    Parameters
    ----------
    entry: Optional[Dict]
        Dictionary to read the optional parameter from
    key: Optional[Any]
        Key to the optional dictionary value

    Returns
    -------
    Optional[Any]
        If dictionary was None or the key was not present,
        None is returned.
        Otherwise, the actual value is returned.
    """
    if entry is None:
        return None
    return entry[key] if key in entry else None


def set_if_not_none(entry: Dict, key: Any, val: Any):
    """
    Sets the value entry if provided value is not None.

    Parameters
    ----------
    entry: Dict
        Dictionary to modify
    key: Any
        Key for the dictionary
    val: Any
        New value for dictionary's entry
    """
    if val is not None:
        entry[key] = val


def sort_dict_list(
    entry: Dict[str, Any], key: str, sort_by: str = False
) -> None:
    """
    Sort list stored as a value for given key. If such key doesn't exist the
    function returns with no effect.

    Additionally if list is a list of dictionaries sort them by the key given
    in 'sort_by' argument.

    Parameters
    ----------
    entry: Dict[str, Any]
        Dictionary to look for list to sort.
    key: str
        Key which is used to store given list.
    sort_by: str
        If sorting list of dictionaries, a field used as sorting key.
    """
    if key not in entry:
        return
    lst = entry[key]
    if sort_by:
        lst.sort(key=lambda v: v[sort_by])
    else:
        lst.sort()


class SpecificationBuilder(object):
    """
    Creates a specification file and checks validity of files.

    This class allows to:

    * Create and modify specification entries using simple API
    * Merge existing specifications with some consistency checks
    * Check URLs to remote resources in terms of availability
    * Checks correctness of paths to assets from the given directory

    This class also performs very strict checking, e.g. it does not
    allow creating duplicates.
    In case of any errors spotted it raises a
    SpecificationBuilderException.
    """

    def __init__(
        self,
        spec_version: str,
        assets_dir: Optional[Path] = None,
        check_urls: bool = False,
    ):
        """
        Creates a SpecificationBuilder instance.

        Parameters
        ----------
        spec_version: str
            Specification version that we are going to use.
            This may affect some of the functions in the Builder
        assets_dir: Optional[Path]
            Path to the assets directory.
            Paths to icons used in the Pipeline Manager are checked
            for presence if this directory is provided.
        check_urls: bool
            Tells if the URLs in the specification should be checked
            for validity and availability
        """
        self.version = spec_version
        self.assets_dir = Path(assets_dir) if assets_dir else None
        self.check_urls = check_urls

        self.reset()

    def reset(self):
        """
        Resets all fields for the specification.
        """
        self._nodes = {}
        self._node_layers = set()
        self._categories = set()
        self._includes: Dict[str, Optional[Style]] = {}
        self._includeGraphs = {}
        self._graphs = {}
        self._metadata = {}
        self.warnings = 0

        if self.check_urls:
            self.session = requests.Session()

    def register_category(self, categorypath: str):
        """
        Adds a category to the set of available categories.

        Parameters
        ----------
        categorypath: str
            Category. Subcategories are added via path-like
            string.
        """
        self._categories.add(categorypath)

    def add_node_type_category(self, name: str, category: str):
        """
        Adds a category to the given node.
        Raises an error if different category is already added.

        Parameters
        ----------
        name: str
            name of the node type
        category: str
            category for the node type

        Raises
        ------
        SpecificationBuilderException
            Raised if there is already a node type category.
        """
        if (
            "category" in self._nodes[name]
            and category != self._nodes[name]["category"]
        ):
            raise SpecificationBuilderException(
                f"Cannot set '{name}' category to {category}: there is already"
                f" a {self._nodes[name]['category']} category defined"
            )
        self._nodes[name]["category"] = category
        self.register_category(category)

    def add_node_type_parent(
        self, name: str, parent_names: Union[str, List[str]]
    ):
        """
        Adds a parent class to the node type.
        Raises an exception if the base name does not
        exist.

        Parameters
        ----------
        name: str
            name of the node type
        parent_names: Union[str, List[str]]
            name of the base class, or list of
            base classes' names.

        Raises
        ------
        SpecificationBuilderException
            Raised when base/parent class is not found.
        """
        if isinstance(parent_names, str):
            parent_names = [parent_names]

        for extcls in parent_names:
            if extcls not in self._nodes:
                raise SpecificationBuilderException(
                    f"Base class {extcls} for {name} class not found"
                )
        if "extends" in self._nodes[name]:
            self._nodes[name]["extends"].extend(parent_names)
        else:
            self._nodes[name]["extends"] = parent_names

    def add_node_type(
        self,
        name: str,
        category: Optional[str] = None,
        layer: Optional[str] = None,
        extends: Optional[Union[str, List[str]]] = None,
        abstract: Optional[bool] = False,
    ):
        """
        Adds a node type to the specification.

        Parameters
        ----------
        name: str
            Name of the node type.
        category: Optional[str]
            Category of the node.
        layer: Optional[str]
            Name of the layer metatype.
        extends: Optional[Union[str, List[str]]]
            Base classes for the node type.
        abstract: Optional[bool]
            Tells if the type is abstract or not.
            Abstract types do not need to be complete, they
            are also not added to the final specification.
            They are templates for other classes.

        Raises
        ------
        SpecificationBuilderException
            Raised if the node type is redefined.
        """
        if name in self._nodes:
            raise SpecificationBuilderException(
                f"Redefined node type:  {name}"
            )
        self._nodes[name] = {"name": name}
        if extends:
            self.add_node_type_parent(name, extends)
        if layer:
            self._nodes[name]["layer"] = layer
            self._node_layers.add(layer)
        if category:
            self.add_node_type_category(name, category)
        if abstract is not None:
            self.set_node_type_abstract(name, abstract)

    def add_node_type_as_category(
        self,
        categoryname: str,
        categoryparent: str = "",
        layer: Optional[str] = None,
        extends: Optional[Union[str, List[str]]] = None,
    ):
        """
        Adds a node type "as category" to the specification.

        Parameters
        ----------
        categoryname: str
            Name of the newly added category
        categoryparent: str
            Path to the new category
        layer: Optional[str]
            Name of the layer metatype
        extends: Optional[Union[str, List[str]]]
            Base classes for the node type

        Raises
        ------
        SpecificationBuilderException
            Raised when node type is redefined.
        """
        if categoryname in self._nodes:
            raise SpecificationBuilderException(
                f"Redefined node type:  {categoryname} in category as node: {categoryparent}"  # noqa: E501
            )
        self._nodes[categoryname] = {
            "category": str(Path(categoryparent) / categoryname)
            if len(categoryparent) != 0
            else categoryname,  # noqa: E501
            "isCategory": True,
        }
        if extends:
            self.add_node_type_parent(categoryname, extends)
        if layer:
            self._nodes[categoryname]["layer"] = layer
            self._node_layers.add(layer)

    def set_node_type_abstract(self, name, value):
        self._nodes[name]["abstract"] = value

    def set_node_description(self, name: str, description: str):
        """
        Sets description for the node type.

        Parameters
        ----------
        name: str
            Name of the node type
        description: str
            Description for the node
        """
        self._nodes[name]["description"] = description

    def add_node_description(self, name: str, description: str):
        """
        Sets description for the node if it is not defined.

        Parameters
        ----------
        name: str
            Name of the node type
        description: str
            Description

        Raises
        ------
        SpecificationBuilderException
            Raised if description is already defined
        """
        if "description" in self._nodes[name]:
            raise SpecificationBuilderException(
                f"The description for {self._nodes[name]} already defined: ${self._nodes[name]['description']}"  # noqa: E501
            )
        self.set_node_description(name, description)

    def get_node_description(self, name: str) -> str:
        """
        Gets description for the node type.

        Parameters
        ----------
        name: str
            Name of the node type

        Returns
        -------
        str
            Description of the node type
        """
        if name not in self._nodes or "description" not in self._nodes[name]:
            return ""
        return self._nodes[name]["description"]

    def add_node_type_icon(
        self, name: str, iconpath: Union[dict, str]
    ) -> None:
        """
        Adds icon for the node type.

        Parameters
        ----------
        name: str
            Name of the node type
        iconpath: Union[dict, str]
            Icon path
        """
        if self.assets_dir and not isinstance(iconpath, dict):
            icon_path_loc = self.assets_dir / iconpath
            if icon_path_loc.is_file():
                self._nodes[name]["icon"] = iconpath
            return

        full_url = self._get_icon_url(iconpath, f"node type {name}")

        if self.check_urls:
            try:
                response = self.session.get(
                    full_url, timeout=4, allow_redirects=True
                )
                if response.status_code != 200:
                    logging.warning(
                        f"Icon for node type {name} does not work (HTTP status: {response.status_code}):  {full_url}"  # noqa: E501
                    )
                    self.warnings += 1
            except (
                requests.ConnectTimeout,
                requests.exceptions.ReadTimeout,
                MaxRetryError,
                TimeoutError,
                ReadTimeoutError,
                ConnectTimeoutError,
            ):
                logging.warning(
                    f"Icon for node type {name} does not work (timeout):  {full_url}"  # noqa: E501
                )
                self.warnings += 1
            except requests.exceptions.MissingSchema:
                logging.warning(
                    f"Icon for node type {name} has invalid URL:  {full_url}"  # noqa: E501
                )
                self.warnings += 1
            except Exception as ex:
                logging.warning(f"WARN: Failed to check icon URL:  {full_url}")
                logging.warning(ex)
                self.warnings += 1
        self._nodes[name]["icon"] = iconpath

    def add_node_type_url(self, name: str, urlgroup: str, suffix: str):
        """
        Adds URL for the node type.

        Parameters
        ----------
        name: str
            Name of the node type
        urlgroup: str
            Name of the URL group the entry is defined for.
            URL group defines prefix, and icon for the URL.
        suffix: str
            Appended suffix to the URL group

        Raises
        ------
        SpecificationBuilderException
            Raised if provided urlgroup does not exist.
        """
        if "urls" not in self._nodes[name]:
            self._nodes[name]["urls"] = {}
        if (
            not self._metadata
            or "urls" not in self._metadata
            or urlgroup not in self._metadata["urls"]
        ):
            raise SpecificationBuilderException(
                f"URL class {urlgroup} is not available in metadata"
            )
        if self.check_urls:
            try:
                full_url = self._metadata["urls"][urlgroup]["url"] + suffix
                response = self.session.get(
                    full_url, timeout=4, allow_redirects=True
                )
                if response.status_code != 200:
                    logging.warning(
                        f"URL for node type {name} does not work (HTTP status: {response.status_code}):  {full_url}"  # noqa: E501
                    )
                    self.warnings += 1
            except (
                requests.ConnectTimeout,
                requests.exceptions.ReadTimeout,
                MaxRetryError,
                TimeoutError,
                ReadTimeoutError,
                ConnectTimeoutError,
            ):
                logging.warning(
                    f"URL for node type {name} does not work (timeout):  {full_url}"  # noqa: E501
                )
                self.warnings += 1
            except Exception as ex:
                logging.warning(f"WARN: Failed to check URL:  {full_url}")
                logging.warning(ex)
                self.warnings += 1

        self._nodes[name]["urls"][urlgroup] = suffix

    def add_node_type_additional_data(self, name: str, additionaldata: Any):
        """
        Adds additional data to the node, in JSON-like format.

        Parameters
        ----------
        name: str
            Name of the node type
        additionaldata: Any
            Any JSON-like construct

        Raises
        ------
        SpecificationBuilderException
            Raised if additionalData already exists.
        """
        if "additionalData" in self._nodes[name]:
            raise SpecificationBuilderException(
                f"The additionalData for {self._nodes[name]} already defined: ${self._nodes[name]['additionalData']}"  # noqa: E501
            )
        self._nodes[name]["additionalData"] = additionaldata

    def add_node_interface_group(
        self,
        node_type_name: str,
        interface_group_name: str,
        direction: Direction = Direction.INOUT,
        interface_type: Optional[str] = None,
        interfaces: Optional[List[Dict]] = None,
    ):
        """
        Add an empty interface group to a node type.

        Parameters
        ----------
        node_type_name : str
            Name of a node type.
        interface_group_name : str
            Name of a newly created interface group.
        direction : Direction
            Direction of the interface group, by default Direction.INOUT.
        interface_type : Optional[str]
            Type of an interface group, by default None.
        interfaces : Optional[List[Dict]]
            A list of interfaces to be added to the interface group.
            It is safer to use `add_interface_to_group_interface`
            method to add interface to an interface group - it performs
            more detailed data validation. Each interface is
            a dictionary with at least two keys: `name` and `direction`.

        Raises
        ------
        MissingInterfaceAttribute
            Raised if either `name` or `direction` is missing in `interfaces`.
        ValueError
            Raised if direction has an illegal value.
        """
        node = self._get_node_type(node_type_name)
        node.setdefault("interfaceGroups", [])

        if interfaces is not None:
            for interface in interfaces:
                if "name" not in interface:
                    raise MissingInterfaceAttribute(
                        "Cannot add an interface missing `name` attribute."
                    )

                if "direction" not in interface:
                    continue

                try:
                    direction = Direction(interface["direction"])
                except ValueError:
                    legal_directions = [value.value() for value in Direction]
                    legal_directions = ", ".join(legal_directions)
                    raise ValueError(
                        "Interface direction has to one of: "
                        f"{legal_directions}."
                        f"However, its value is: {direction}"
                    )

        interface_group = {
            "name": interface_group_name,
            "direction": direction.value,
            "interfaces": interfaces if interfaces is not None else [],
        }
        set_if_not_none(interface_group, "type", interface_type)

        node["interfaceGroups"].append(interface_group)

    def _get_node_type(self, node_type_name: str) -> Dict[str, Any]:
        """
        Get a node type from the specification.

        Parameters
        ----------
        node_type_name : str
            Name of the requested node type.

        Returns
        -------
        Dict[str, Any]
            Node type definition.

        Raises
        ------
        ValueError
            Raised if a node type does not exist.
        """
        if node_type_name not in self._nodes:
            raise ValueError(
                f"Node type `{node_type_name} is not associated with any node."
            )
        return self._nodes[node_type_name]

    def add_interface_to_group_interface(
        self,
        node_type_name: str,
        interface_group_name: str,
        actual_interface_name: str,
        index_or_indices: Union[int, Tuple[int]],
        direction: Direction = Direction.INOUT,
        max_connection_count: Optional[int] = None,
        side: Optional[Side] = None,
    ):
        """
        Add an interface or a range of interfaces to an existing
        interface group.

        Parameters
        ----------
        node_type_name : str
            Name of the node type.
        interface_group_name : str
            Name of the interface group.
        actual_interface_name : str
            Name of the actual interface to be split within groups.
        index_or_indices : Union[int, Tuple[int]]
            Either a single index of a new interface or [lower, upper)
            range of interface to be added to the group interface.
        direction : Direction, optional
            Direction of the interface. By default, Direction.INOUT.
        max_connection_count : Optional[int], optional
            Maximal number of connection of the interface or the range
            of interface. By default, None.
        side : Optional[Side], optional
            Side, where the interface or the group of interface should
            be located. By default, None.

        Raises
        ------
        TypeError
            Raised if:
            - an unsupported type of `index_or_indices` was provided,
            - a provided range of indices has size different than two.
        ValueError
            Raised if:
            - there is no interface group present in the specification builder,
            - a group with `interface_group_name` does not exist.

        """
        if isinstance(index_or_indices, int):
            name = f"{actual_interface_name}[{index_or_indices}]"
            array = None
        elif isinstance(index_or_indices, Tuple) or isinstance(
            index_or_indices, List
        ):
            if len(index_or_indices) != 2:
                raise TypeError(
                    "Range has to have exactly two elements: [min, max)."
                    f"{len(index_or_indices)} were provided."
                )
            name = actual_interface_name
            array = list(index_or_indices)
        else:
            raise TypeError(
                "Unsupported type for interface index: "
                f"`{type(index_or_indices)}`."
                "Supported types: int, Tuple[int, int]."
            )
        interface = {
            "name": name,
            "direction": direction.value,
        }
        set_if_not_none(interface, "array", array)
        set_if_not_none(interface, "maxConnectionCount", max_connection_count)
        set_if_not_none(interface, "side", side)

        node = self._get_node_type(node_type_name)
        if "interfaceGroups" not in node:
            raise ValueError(
                "Cannot add an interface or a range of interface as no "
                "interface group exists."
            )
        matching_group = [
            interface_group
            for interface_group in node["interfaceGroups"]
            if interface_group["name"] == interface_group_name
        ]
        if len(matching_group) != 1:
            raise ValueError(
                "Cannot add an interface or a range of interface to the "
                f"non-existent interface group `{interface_group_name}`."
            )
        matching_group[0]["interfaces"].append(interface)

    def enable_interface_group_by_default(
        self, node_name: str, interface_group: str, direction: Direction
    ):
        """
        Add an interface group to default interface groups of a node type.

        The default interface group contains a list of
        interface groups enabled by default. Adding an
        interface group there effectively enables the
        interface group from the specification.

        Parameters
        ----------
        node_name : str
            Name of the node type.
        interface_group : str
            Name of the interface group.
        direction : Direction
            Direction of the interface group.

        Raises
        ------
        ValueError
            Raised if:
            - the node with the provided `node_name` does
              not have any interface groups,
            - more than one interface group matches provided
              `interface_group` and `direction`,
            - none of interface groups matches provided
              `interface_group` and `direction`.
        """
        node = self._get_node_type(node_name)
        if "interfaceGroups" not in node:
            raise ValueError(
                f"Node type `{node_name}` does not have any interface groups."
            )

        interface_groups = [
            interface
            for interface in node["interfaceGroups"]
            if interface["name"] == interface_group
            and interface["direction"] == direction.value
        ]
        if len(interface_groups) != 1:
            raise ValueError(
                "Expected exactly one interface group to match name = "
                f"`{interface_group}` and direction = `{direction.value}` but"
                f" found {len(interface_groups)} matching interface groups."
            )

        new_group = {"name": interface_group, "direction": direction.value}

        if "defaultInterfaceGroups" in node:
            node["defaultInterfaceGroups"].append(new_group)
        else:
            node["defaultInterfaceGroups"] = [new_group]

    def add_node_type_interface(
        self,
        name: str,
        interfacename: str,
        interfacetype: Optional[Union[str, List[str]]] = None,
        direction: str = "inout",
        dynamic: Union[bool, List[int]] = False,
        side: Optional[str] = None,
        maxcount: Optional[int] = None,
        override: Optional[bool] = None,
        array: Optional[List[int]] = None,
    ):
        """
        Adds interface to the node type.

        Parameters
        ----------
        name: str
            Name of the node type
        interfacename: str
            Name of the interface
        interfacetype: Optional[Union[str, List[str]]]
            List of matching types for interfaces
        direction: str
            Direction of the connection, by default "inout".
        dynamic: Union[bool, List[int]]
            Determine whether a number of interfaces may be
            dynamically adjusted. By default, False.
        side: Optional[str]
            On which side the interface should be placed by default
        maxcount: Optional[int]
            The maximum connections to the given interface
        override: Optional[bool]
            Determines whether interface should be overridden
        array : Optional[List[int]]
            Creates an array of interfaces with given name.
            Accepts two integers - minimal and maximal value

        Raises
        ------
        SpecificationBuilderException
            Raised when interface already exists.
        """
        if "interfaces" not in self._nodes[name]:
            self._nodes[name]["interfaces"] = []

        if any(
            [
                entry["name"] == interfacename and entry["direction"] == side
                for entry in self._nodes[name]["interfaces"]
            ]
        ):
            raise SpecificationBuilderException(
                f"Interface of the same direction ({side}) and name "
                f"({interfacename}) already exists in {name}"
            )

        assert direction in ["input", "output", "inout"]
        assert side in [None, "left", "right"]

        interface = {"name": interfacename, "direction": direction}

        set_if_not_none(interface, "type", interfacetype)
        set_if_not_none(interface, "side", side)
        set_if_not_none(interface, "maxConnectionsCount", maxcount)
        set_if_not_none(interface, "override", override)
        set_if_not_none(interface, "array", array)

        if dynamic:
            assert isinstance(dynamic, bool) or isinstance(dynamic, List), (
                "A value of an interface's property `dynamic` has to "
                "take either True or list of size 2: [min, max]. "
                f"Provided: {dynamic} of type {type(dynamic)}, "
                "which is unsupported."
            )
            interface["dynamic"] = dynamic

        self._nodes[name]["interfaces"].append(interface)

    def create_property(
        self,
        propname: str,
        proptype: str,
        default: Any,
        description: Optional[str] = None,
        min: Any = None,
        max: Any = None,
        values: Optional[List[Any]] = None,
        dtype: Optional[str] = None,
        override: Optional[bool] = None,
    ) -> dict:
        """
        Creates and returns a property.

        Parameters
        ----------
        propname: str
            Name of the property
        proptype: str
            Type of the property
        default: Any
            Default value of the property
        description: Optional[str]
            Optional description for the property
        min: Any
            Minimal value
        max: Any
            Maximal value
        values: Optional[List[Any]]
            List of allowed values
        dtype: Optional[str]
            Type of elements in property type is list
        override: Optional[bool]
            Determines whether property should be overridden

        Returns
        -------
        dict
            Creates a single property for the node type
        """
        prop = {"name": propname, "type": proptype, "default": default}

        set_if_not_none(prop, "description", description)
        set_if_not_none(prop, "min", min)
        set_if_not_none(prop, "max", max)
        set_if_not_none(prop, "values", values)
        set_if_not_none(prop, "dtype", dtype)
        set_if_not_none(prop, "override", override)

        return prop

    def add_node_type_property_group(
        self,
        name: str,
        propgroupname: str,
        propname: str,
        proptype: str,
        default: Any,
        description: Optional[str] = None,
        min: Any = None,
        max: Any = None,
        values: Optional[List[Any]] = None,
        dtype: Optional[str] = None,
        override: Optional[bool] = None,
    ):
        """
        Adds a property to a property group.

        Parameters
        ----------
        name: str
            Name of the node type
        propgroupname: str
            Name of the group of property
        propname: str
            Name of the property
        proptype: str
            Type of the property
        default: Any
            Default value of the property
        description: Optional[str]
            Optional description for the property
        min: Any
            Minimal value
        max: Any
            Maximal value
        values: Optional[List[Any]]
            List of allowed values
        dtype: Optional[str]
            Type of elements in property type is list
        override: Optional[bool]
            Determines whether property should be overridden

        Raises
        ------
        SpecificationBuilderException
            Raised when no properties are found that could be bound
            to the group.
        """
        if "properties" not in self._nodes[name] or all(
            entry["name"] != propgroupname
            for entry in self._nodes[name]["properties"]
        ):
            raise SpecificationBuilderException(
                f"Property {propgroupname} does not exits"
            )

        prop = self.create_property(
            propname,
            proptype,
            default,
            description,
            min,
            max,
            values,
            dtype,
            override,
        )

        for entry in self._nodes[name]["properties"]:
            if entry["name"] == propgroupname:
                if "group" not in entry:
                    entry["group"] = []
                entry["group"].append(prop)
                break

    def add_node_type_property(
        self,
        name: str,
        propname: str,
        proptype: str,
        default: Any,
        description: Optional[str] = None,
        min: Any = None,
        max: Any = None,
        values: Optional[List[Any]] = None,
        dtype: Optional[str] = None,
        override: Optional[bool] = None,
    ):
        """
        Adds property to the node.

        Parameters
        ----------
        name: str
            Name of the node type
        propname: str
            Name of the property
        proptype: str
            Type of the property
        default: Any
            Default value of the property
        description: Optional[str]
            Optional description for the property
        min: Any
            Minimal value
        max: Any
            Maximal value
        values: Optional[List[Any]]
            List of allowed values
        dtype: Optional[str]
            Type of elements in property type is list
        override: Optional[bool]
            Determines whether property should be overridden

        Raises
        ------
        SpecificationBuilderException
            Raised when the property exists already.
        """
        if "properties" not in self._nodes[name]:
            self._nodes[name]["properties"] = []

        if any(
            [
                entry["name"] == propname
                for entry in self._nodes[name]["properties"]
            ]
        ):
            raise SpecificationBuilderException(
                f"Property of the same name ({propname}) already exists in {name}"  # noqa: E501
            )

        prop = self.create_property(
            propname,
            proptype,
            default,
            description,
            min,
            max,
            values,
            dtype,
            override,
        )
        self._nodes[name]["properties"].append(prop)

    def add_node_type_color(self, name: str, color: str):
        """
        Sets color for the node.

        Parameters
        ----------
        name: str
            Name of the node
        color: str
            Color of the node
        """
        self._nodes[name]["color"] = color

    def add_node_type_style(self, name: str, style: Style):
        """
        Sets style for the node.

        Parameters
        ----------
        name: str
            Name of the node
        style: Style
            Style of the node

        Raises
        ------
        SpecificationBuilderException
            Raised when the given style is not present egistered in metadata
        """
        styles = (self._metadata or {}).get("styles", {})
        if style is not None:
            for i_style in self._style_to_list(style):
                if i_style not in styles:
                    raise SpecificationBuilderException(
                        f"Style {i_style} not found"
                    )

        node_ref = self._nodes[name]
        if "style" not in self._nodes[name]:
            node_ref["style"] = style
        else:
            node_ref["style"] = self._style_to_list(node_ref["style"])
            node_ref["style"] += self._style_to_list(style)

    def add_node_type_subgraph_id(self, name: str, subgraph_id: str):
        """
        Sets subgraph ID for the node.

        Parameters
        ----------
        name: str
            Name of the node
        subgraph_id: str
            Subgraph ID of the node
        """
        self._nodes[name]["subgraphId"] = subgraph_id

    def add_node_type_related_graph(self, name: str, related_graph_name: str):
        if "relatedGraphs" not in self._nodes[name]:
            self._nodes[name]["relatedGraphs"] = []
        self._nodes[name]["relatedGraphs"].append(
            {
                "name": related_graph_name,
                "id": self._graphs[related_graph_name]["id"],
            }
        )

    def update_node_type_from_spec(self, node):
        if node.get("isCategory", False):
            if "category" not in node:
                raise SpecificationBuilderException(
                    "The given category node specification is invalid - it is "
                    "missing the 'category' field\n"
                    f"{json.dumps(node, indent=4)}"
                )
            if "/" in node["category"]:
                nodename = node["category"].rsplit("/", 1)[-1]
            else:
                nodename = node["category"]
        else:
            if "name" not in node:
                raise SpecificationBuilderException(
                    "The given node specification is invalid - it is "
                    "missing the 'name' field\n"
                    f"{json.dumps(node, indent=4)}"
                )
            nodename = node["name"]
        if "icon" in node:
            self.add_node_type_icon(nodename, node["icon"])
        if "urls" in node:
            for urlgroup, urlsuffix in node["urls"].items():
                self.add_node_type_url(nodename, urlgroup, urlsuffix)
        if "additionalData" in node:
            self.add_node_type_additional_data(
                nodename, node["additionalData"]
            )
        if "description" in node:
            self.add_node_description(nodename, node["description"])
        if "color" in node:
            self.add_node_type_color(nodename, node["color"])
        if "subgraphId" in node:
            self.add_node_type_subgraph_id(nodename, node["subgraphId"])
        for interface in node.get("interfaces", []):
            iface = None
            if "type" in interface:
                if isinstance(interface["type"], list):
                    iface = [typ for typ in interface["type"]]
                else:
                    iface = interface["type"]
            self.add_node_type_interface(
                name=nodename,
                interfacename=interface["name"],
                interfacetype=iface,
                dynamic=get_optional(interface, "dynamic"),
                direction=get_optional(interface, "direction"),
                side=get_optional(interface, "side"),
                maxcount=get_optional(interface, "maxConnectionsCount"),
                override=get_optional(interface, "override"),
                array=get_optional(interface, "array"),
            )
        for interface_group in node.get("interfaceGroups", []):
            if "name" not in interface_group:
                raise SpecificationBuilderException(
                    "Missing property `name` in the specification of"
                    "an interface group."
                )
            direction = get_optional(interface_group, "direction")
            self.add_node_interface_group(
                node_type_name=nodename,
                interface_group_name=interface_group["name"],
                direction=Direction(direction)
                if direction is not None
                else None,
                interface_type=get_optional(interface_group, "type"),
            )

            for interface_or_range in interface_group.get("interfaces", []):
                indices = None
                index = None
                if "array" in interface_or_range:
                    indices = interface_or_range["array"]
                else:
                    pattern = r"\[[0-9]+\]$"
                    match = re.search(
                        pattern=pattern, string=interface_group["name"]
                    )
                    index = int(match.group()[1:-1])

                interface_direction = get_optional(
                    interface_or_range, "direction"
                )
                if interface_direction is not None:
                    interface_direction = Direction(interface_direction)

                self.add_interface_to_group_interface(
                    node_type_name=nodename,
                    actual_interface_name=interface_or_range["name"],
                    interface_group_name=interface_group["name"],
                    index_or_indices=index or indices,
                    direction=interface_direction,
                    max_connection_count=get_optional(
                        interface_or_range, "maxConnectionCount"
                    ),
                    side=get_optional(interface_or_range, "side"),
                )

        for property in node.get("properties", []):
            self.add_node_type_property(
                nodename,
                property["name"],
                property["type"],
                property["default"],
                get_optional(property, "description"),
                get_optional(property, "min"),
                get_optional(property, "max"),
                get_optional(property, "values"),
                get_optional(property, "dtype"),
                get_optional(property, "override"),
            )
            if "group" in property:
                for childprop in property["group"]:
                    self.add_node_type_property_group(
                        nodename,
                        property["name"],
                        childprop["name"],
                        childprop["type"],
                        childprop["default"],
                        get_optional(childprop, "description"),
                        get_optional(childprop, "min"),
                        get_optional(childprop, "max"),
                        get_optional(childprop, "values"),
                        get_optional(childprop, "dtype"),
                        get_optional(property, "override"),
                    )

    def add_node_type_from_spec(self, node):
        """
        Adds single node type defined in JSON-like format.
        """
        if node.get("isCategory", False):
            if "category" not in node:
                raise SpecificationBuilderException(
                    "The given category node specification is invalid - it is "
                    "missing the 'category' field\n"
                    f"{json.dumps(node, indent=4)}"
                )
            if "/" in node["category"]:
                categoryparent, nodename = node["category"].rsplit("/", 1)
            else:
                categoryparent = ""
                nodename = node["category"]
            self.add_node_type_as_category(
                categoryname=nodename,
                categoryparent=categoryparent,
                layer=get_optional(node, "layer"),
                extends=get_optional(node, "extends"),
            )
        else:
            if "name" not in node:
                raise SpecificationBuilderException(
                    "The given node specification is invalid - it is "
                    "missing the 'name' field\n"
                    f"{json.dumps(node, indent=4)}"
                )
            nodename = node["name"]
            self.add_node_type(
                name=nodename,
                category=get_optional(node, "category"),
                layer=get_optional(node, "layer"),
                extends=get_optional(node, "extends"),
                abstract=get_optional(node, "abstract"),
            )
        self.update_node_type_from_spec(node)

    def add_subgraph_from_spec(self, subgraph):
        """
        Adds subgraph defined in JSON-like format.
        """
        if subgraph["name"] in self._graphs:
            raise SpecificationBuilderException(
                f'Subgraph {subgraph["name"]} already exists.'  # noqa: E501
            )
        self._graphs[subgraph["name"]] = subgraph

    def add_include(self, include: str, style: Optional[Style] = None):
        """
        Adds include defined by url to the specification.

        Parameters
        ----------
        include: str
            URL to the specification to include
        style: Optional[Style]
            Style of included nodes

        Raises
        ------
        SpecificationBuilderException
            Raised when include already exists.
        """
        styles = (self._metadata or {}).get("styles", {})
        if style is not None:
            for i_style in self._style_to_list(style):
                if i_style not in styles:
                    raise SpecificationBuilderException(
                        f"Style {i_style} not found"
                    )

        if include in self._includes:
            raise SpecificationBuilderException(
                f"Include {include} already exists."
            )

        if style:
            self._includes[include] = style
        else:
            self._includes[include] = None

    def add_include_subgraph(self, dataflow: Dict[Tuple[str, str], str]):
        """
        Adds dataflow to the include subgraph defined by url.

        Parameters
        ----------
        dataflow: Dict[Tuple[str, str], str]
            Dataflow to include. Keys are tuples of node names and node urls

        Raises
        ------
        SpecificationBuilderException
            Raised when included subgraph already exists
        """
        dataflow_key = (dataflow.get("name", "default"), dataflow["url"])
        if dataflow_key in self._includeGraphs:
            raise SpecificationBuilderException(
                f"Include subgraph {dataflow_key} already exists."
            )
        self._includeGraphs[dataflow_key] = dataflow

    def metadata_add_node_style(
        self,
        stylename: str,
        styleicon: Optional[Union[str, Dict]] = None,
        stylecolor: Optional[str] = None,
    ):
        """
        Adds node styling to metadata.

        Parameters
        ----------
        stylename : str
            Name of the style
        styleicon : Optional[Union[str, Dict]]
            Icon of the style
        stylecolor : Optional[str]
            Color of the style

        Raises
        ------
        SpecificationBuilderException
            Raised when the style already exists
        """
        if "styles" not in self._metadata:
            self._metadata["styles"] = {}
        if stylename in self._metadata["styles"]:
            raise SpecificationBuilderException(
                f"Style {stylename} already exists."
            )

        style = {}
        set_if_not_none(style, "color", stylecolor)
        set_if_not_none(
            style,
            "icon",
            styleicon and self._get_icon_url(styleicon, f"style {stylename}"),
        )
        self._metadata["styles"][stylename] = style

    def metadata_add_interface_styling(
        self,
        interfacename: str,
        interfacecolor: Optional[str] = None,
        interfaceconnpattern: Optional[str] = None,
        interfaceconncolor: Optional[str] = None,
    ):
        """
        Adds interface styling to metadata.

        interfacename: str
            Name of the interface type
        interfacecolor: Optional[str]
            Color of the interface
        interfaceconnpattern: Optional[str]
            Interface connection line pattern
        interfaceconncolor: Optional[str]
            Color of the interface connection line
        """
        if "interfaces" not in self._metadata:
            self._metadata["interfaces"] = {}
        if interfacename in self._metadata["interfaces"]:
            raise SpecificationBuilderException(
                f"Styling for interface {interfacename} already exists."
            )
        props = {}
        set_if_not_none(props, "interfaceColor", interfacecolor)
        set_if_not_none(
            props, "interfaceConnectionPattern", interfaceconnpattern
        )
        set_if_not_none(props, "interfaceConnectionColor", interfaceconncolor)
        if props:
            self._metadata["interfaces"][interfacename] = props

    def metadata_add_layer(
        self,
        name: str,
        nodelayers: Optional[Union[str, List[str]]] = None,
        nodeinterfaces: Optional[Union[str, List[str]]] = None,
    ):
        """
        Adds nodes' layer to metadata.

        Parameters
        ----------
        name: str
            Name of the layer
        nodelayers: Optional[Union[str, List[str]]]
            List of node layers in the layer
        nodeinterfaces: Optional[Union[str, List[str]]]
            List of interface types in the layer

        Raises
        ------
        SpecificationBuilderException
            Raised when provided layer already exists.
        """
        if "layers" not in self._metadata:
            self._metadata["layers"] = []

        assert nodelayers or nodeinterfaces

        if any([entry["name"] == name for entry in self._metadata["layers"]]):
            raise SpecificationBuilderException(
                f"Layer {name} already exists."
            )
        entry = {"name": name}
        set_if_not_none(entry, "nodeLayers", nodelayers)
        set_if_not_none(entry, "nodeInterfaces", nodeinterfaces)

        if "nodeInterfaces" in entry:
            entry["nodeInterfaces"] = [
                intf.lower() for intf in entry["nodeInterfaces"]
            ]
        self._metadata["layers"].append(entry)

    def metadata_add_url(
        self, groupname: str, displayname: str, icon: str, url: str
    ):
        """
        Adds URL group to metadata.

        Parameters
        ----------
        groupname: str
            Name of the URL group
        displayname: str
            Displayable name of the URL group
        icon: str
            Path in assets directory or URL to the icon
        url: str
            URL prefix for the URL group

        Raises
        ------
        SpecificationBuilderException
            Raised when URL group already exists and differs in format with
            the existing entry.
        """
        if "urls" not in self._metadata:
            self._metadata["urls"] = {}

        entry = {"name": displayname, "icon": icon, "url": url}

        if (
            groupname in self._metadata["urls"]
            and self._metadata["urls"][groupname] != entry
        ):
            raise SpecificationBuilderException(
                f'URL group {groupname} already exists and is different:\n'
                f'Current:\n{self._metadata["urls"][groupname]}\nNew:\n{entry}'
            )

        self._metadata["urls"][groupname] = entry

    def metadata_add_param(
        self, paramname: str, paramvalue: Any, metadata: Optional[Dict] = None
    ):
        """
        Sets parameter in metadata.
        Modifies the metadata dictionary in place.

        The following rules apply:
        * If the parameter is a list and the value is a list, the parameter
        is extended by the value.
        * If the parameter is a dictionary and the value is a dictionary, the
        parameter is recursively updated by the value.
        * Otherwise, the parameter is set to the value.

        Parameters
        ----------
        paramname: str
            Name of the metadata parameter
        paramvalue: Any
            Value of the parameter
        metadata: Optional[Dict]
            Metadata dictionary to modify. if None, the class metadata is used
        """
        metadata = metadata if metadata else self._metadata
        current_value = metadata.get(paramname, None)
        if isinstance(current_value, list) and isinstance(paramvalue, list):
            metadata[paramname].extend(paramvalue)
        elif isinstance(current_value, dict) and isinstance(paramvalue, dict):
            for key, val in paramvalue.items():
                self.metadata_add_param(
                    key,
                    val,
                    metadata[paramname],
                )
        else:
            metadata[paramname] = paramvalue

    def update_spec_from_other(self, otherspec: Any):
        """
        Updates the specification from other specification.
        It can be also used to merge partial specifications.

        Parameters
        ----------
        otherspec: Any
            JSON-like structure with other specification

        Raises
        ------
        SpecificationBuilderException
            Raised when "extends" in any node has non-existent classes
        """
        metadata = otherspec.get("metadata", {})
        for prop, propvalue in metadata.items():
            if prop == "interfaces":
                for interfacename, interfacestyle in propvalue.items():
                    self.metadata_add_interface_styling(
                        interfacename.lower(),
                        get_optional(interfacestyle, "interfaceColor"),
                        get_optional(
                            interfacestyle, "interfaceConnectionPattern"
                        ),
                        get_optional(
                            interfacestyle, "interfaceConnectionColor"
                        ),
                    )
            elif prop == "urls":
                for urlname, urlentry in propvalue.items():
                    self.metadata_add_url(
                        urlname,
                        urlentry["name"],
                        urlentry["icon"],
                        urlentry["url"],
                    )
            elif prop == "layers":
                for layer in propvalue:
                    self.metadata_add_layer(
                        layer["name"],
                        get_optional(layer, "nodeLayers"),
                        get_optional(layer, "nodeInterfaces"),
                    )
            else:
                self.metadata_add_param(prop, propvalue)
        newnodes = list(otherspec.get("nodes", []))
        previousmissing = set()
        missing = set()
        while len(newnodes) > 0:
            currnodes = list(newnodes)
            newnodes = []
            for node in currnodes:
                if extends := get_optional(node, "extends"):
                    for basenode in extends:
                        if basenode not in self._nodes:
                            newnodes.append(node)
                            missing.add(basenode)
                            break
                    else:
                        self.add_node_type_from_spec(node)
                else:
                    self.add_node_type_from_spec(node)
            if missing == previousmissing and len(missing) > 0:
                raise SpecificationBuilderException(
                    f"Classes from other spec are not found:  {missing}"
                )
            previousmissing = set(missing)
            missing = set()
        for subgraph in otherspec.get("graphs", []):
            self.add_subgraph_from_spec(subgraph)
        for include in otherspec.get("include", []):
            if isinstance(include, str):
                self.add_include(include)
            else:
                self.add_include(include["url"], include.get("style"))
        for includeGraphs in otherspec.get("includeGraphs", []):
            self.add_include_subgraph(includeGraphs)

    def _sorted_nodes(self) -> List[Dict]:
        """
        Returns sorted nodes, with sorted contents - dictionaries and lists.

        Returns
        -------
        List[Dict]
            List of sorted nodes, including their sorted contents.
        """
        for node in self._nodes.values():
            sort_dict_list(node, "interfaces", sort_by="name")
            sort_dict_list(node, "properties", sort_by="name")

            if "interfaces" in node:
                for iface in node["interfaces"]:
                    if "type" in iface and not isinstance(iface["type"], str):
                        sort_dict_list(iface, "type")

            if "properties" in node:
                for prop in node["properties"]:
                    sort_dict_list(prop, "values")
                    sort_dict_list(prop, "group", sort_by="name")

                    if "group" in prop:
                        for group in prop["group"]:
                            sort_dict_list(group, "values")

            for interface_group in node.get("interfaceGroups", []):
                sort_dict_list(interface_group, "interfaces", sort_by="name")

        sorted_tuples = sorted(self._nodes.items())
        sorted_nodes = list(zip(*sorted_tuples))
        return sorted_nodes[1] if sorted_nodes else []

    def _sorted_metadata(self) -> Dict:
        """
        Sorts and returns metadata for the specification.

        Returns
        -------
        Dict
            Dictionary describing metadata for the specification
        """
        if "layers" in self._metadata:
            sort_dict_list(self._metadata, "layers", sort_by="name")
            for layer in self._metadata["layers"]:
                sort_dict_list(layer, "nodeInterfaces")
                sort_dict_list(layer, "nodeLayers")
        return self._metadata

    def _sorted_graphs(self) -> List[Dict]:
        """
        Sorts subgraph entries in the specification and returns them.

        Returns
        -------
        List[Dict]
            A list of dictionaries describing subgraphs.
        """
        sort_dict_list(self._graphs, "nodes", sort_by="name")
        for graph in self._graphs.values():
            sort_dict_list(graph, "connections", sort_by="from")
            sort_dict_list(graph, "interfaces", sort_by="name")
            sort_dict_list(graph, "nodes", sort_by="name")

            if "nodes" in graph:
                for node in graph["nodes"]:
                    sort_dict_list(node, "interfaces", sort_by="name")
                    sort_dict_list(node, "properties", sort_by="name")

        sorted_tuples = sorted(self._graphs.items())
        return list(zip(*sorted_tuples))[1]

    def _get_metadata(self, sort_spec: bool) -> Dict:
        if sort_spec:
            return self._sorted_metadata()
        return self._metadata

    def _get_icon_url(self, icon: Union[Dict, str, Any], label: str) -> str:
        if isinstance(icon, str):
            return icon
        if isinstance(icon, dict):
            if len(icon) != 1:
                raise SpecificationBuilderException(
                    f"Icon with prefix {json.dumps(icon)} for {label} can only have one element"  # noqa: E501
                )
            group, suffix = list(icon.items())[0]
            if (
                not self._metadata
                or "icons" not in self._metadata
                or group not in self._metadata["icons"]
            ):
                raise SpecificationBuilderException(
                    f"Icons class {group} is not available in metadata"
                )
            return self._metadata["icons"][group] + suffix
        else:
            raise SpecificationBuilderException(
                f"Icon with prefix {icon} for {label} has invalid format"
            )

    def _get_nodes(self, sort_spec: bool) -> List[Dict]:
        if sort_spec:
            return self._sorted_nodes()
        return list(self._nodes.values())

    def _get_graphs(self, sort_spec: bool) -> List[Dict]:
        if sort_spec:
            return self._sorted_graphs()
        return list(self._graphs.values())

    def _get_includes(self, sort_spec: bool) -> List[str]:
        if sort_spec:
            return sorted(self._includes)
        return list(self._includes)

    def _get_include_graphs(self, sort_spec: bool) -> List[Dict]:
        if sort_spec:
            return sorted(self._includeGraphs.values())
        return list(self._includeGraphs.values())

    def _style_to_list(self, style: Style):
        return style if isinstance(style, list) else [style]

    def _construct_specification(self, sort_spec: bool) -> Dict:
        """
        Builds specification from the builder data.

        Parameters
        ----------
        sort_spec: bool
            True if the entries in the specification should be sorted.

        Returns
        -------
        Dict
            Full specification from SpecificationBuilder
        """
        spec = {"version": self.version}
        spec["nodes"] = self._get_nodes(sort_spec)
        if self._metadata:
            spec["metadata"] = self._get_metadata(sort_spec)
        if self._graphs:
            spec["graphs"] = self._get_graphs(sort_spec)
        if self._includes:
            spec["include"] = [
                {"url": include, "style": style}
                if (style := self._includes.get(include))
                else include
                for include in self._get_includes(sort_spec)
            ]
        if self._includeGraphs:
            spec["includeGraphs"] = self._get_include_graphs(sort_spec)
        return spec

    def create_and_validate_spec(
        self,
        workspacedir: Optional[Path] = None,
        resolved_specification: Optional[Path] = None,
        fail_on_warnings: bool = True,
        sort_spec: bool = False,
        dump_spec: Optional[Path] = None,
        skip_validation: bool = False,
    ) -> Dict:
        """
        Creates a specification and validates it using schema.

        Parameters
        ----------
        workspacedir: Optional[Path]
            Path to the workspace directory for Pipeline Manager
        resolved_specification : Optional[Path]
            Path to specification that has have resolved
            inheritance, i.e. resolved 'extends' attributes.
            If none then the specification is not resolved.
        fail_on_warnings: bool
            Tells if the specification creation should fail on warnings
        sort_spec: bool
            True if the entries in the specification should be sorted.
        dump_spec: Optional[Path]
            Tells where the specification should be dumped to file
            before validation and resolving for debugging purposes.
        skip_validation : bool
            Whether validation of the specification should be omitted.

        Returns
        -------
        Dict
            Built specification, if successful

        Raises
        ------
        SpecificationBuilderException
            Raised when specification is not valid or when warnings appeared.
        """
        import tempfile

        spec = self._construct_specification(sort_spec)

        if workspacedir:
            workspacedir = Path(workspacedir)

        with tempfile.TemporaryDirectory() as tmpdir:
            specpath = Path(tmpdir) / "spec.json"
            with open(Path(tmpdir) / "spec.json", "w") as spec_file:
                json.dump(
                    spec,
                    spec_file,
                    indent=4,
                    sort_keys=True,
                    ensure_ascii=False,
                )
            if dump_spec:
                with open(dump_spec, "w") as spec_file:
                    json.dump(
                        spec,
                        spec_file,
                        indent=4,
                        sort_keys=True,
                        ensure_ascii=False,
                    )

            if skip_validation:
                logging.warning(
                    (
                        "Validation was omitted. "
                        "An invalid specification may be generated. "
                        "Consider turning on the validation in %s."
                    ),
                    self.create_and_validate_spec.__qualname__,
                )
            else:
                res = validate(
                    specification_path=specpath,
                    workspace_directory=workspacedir,
                    resolved_specification_path=resolved_specification,
                )

                if res != 0:
                    raise SpecificationBuilderException(
                        "Builder validation failed."
                    )

            if fail_on_warnings:
                if self.warnings > 0:
                    raise SpecificationBuilderException(
                        f"Builder reported {self.warnings} issues, failing..."
                    )

            if resolved_specification:
                with open(resolved_specification) as f:
                    spec = json.load(f)
        return spec
