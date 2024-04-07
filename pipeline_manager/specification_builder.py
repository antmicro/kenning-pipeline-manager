# Copyright (c) 2020-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Module for constructing the specification for the Pipeline Manager.

Can be used by other applications to quickly form the specification
for the Pipeline Manager server.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import requests
from urllib3.exceptions import (
    ConnectTimeoutError,
    MaxRetryError,
    ReadTimeoutError,
)

from pipeline_manager.validator import validate


class SpecificationBuilderException(Exception):
    """
    Is raised when any inconsistency in the specification generation
    is spotted.
    """

    pass


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
    if val:
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
        self._nodes = dict()
        self._nodelayers = set()
        self._categories = set()
        self._subgraphs = dict()
        self._metadata = dict()
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
            Name of the node type
        category: Optional[str]
            Category of the node
        layer: Optional[str]
            Name of the layer metatype
        extends: Optional[Union[str, List[str]]]
            Base classes for the node type
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
            self._nodelayers.add(layer)
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
            self._nodelayers.add(layer)

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

        Raises
        ------
        SpecificationBuilderException
            Raised when given icon is not available in metadata or is invalid.
        """
        if self.assets_dir and not isinstance(iconpath, dict):
            icon_path_loc = self.assets_dir / iconpath
            if icon_path_loc.is_file():
                self._nodes[name]["icon"] = iconpath
            return

        full_url = None

        if isinstance(iconpath, dict):
            if len(iconpath) != 1:
                raise SpecificationBuilderException(
                    f"Icon with prefix {json.dumps(iconpath)} for node type {name} can only have one element"  # noqa: E501
                )
            group, suffix = list(iconpath.items())[0]
            if (
                not self._metadata
                or "icons" not in self._metadata
                or group not in self._metadata["icons"]
            ):
                raise SpecificationBuilderException(
                    f"Icons class {group} is not available in metadata"
                )
            full_url = self._metadata["icons"][group] + suffix
        elif isinstance(iconpath, str):
            full_url = iconpath
        else:
            raise SpecificationBuilderException(
                f"Icon with prefix {iconpath} for node type {name} has invalid format"  # noqa: E501
            )

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

    def add_node_type_interface(
        self,
        name: str,
        interfacename: str,
        interfacetype: Optional[Union[str, List[str]]],
        direction: str,
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
            Direction of the connection
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

        if interfacetype is not None:
            interface["type"] = (
                [typ for typ in interfacetype]
                if isinstance(interfacetype, list)
                else interfacetype
            )  # noqa: E501

        set_if_not_none(interface, "side", side)
        set_if_not_none(interface, "maxConnectionsCount", maxcount)
        set_if_not_none(interface, "override", override)
        set_if_not_none(interface, "array", array)

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
        for interface in node.get("interfaces", []):
            self.add_node_type_interface(
                name=nodename,
                interfacename=interface["name"],
                interfacetype=[typ.lower() for typ in interface["type"]]
                if isinstance(interface["type"], list)
                else interface["type"].lower(),  # noqa: E501
                direction=interface["direction"],
                side=get_optional(interface, "side"),
                maxcount=get_optional(interface, "maxConnectionsCount"),
                override=get_optional(interface, "override"),
                array=get_optional(interface, "array"),
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

    def add_subgraph_from_spec(self, subgraph):
        """
        Adds subgraph defined in JSON-like format.
        """
        if subgraph["name"] in self._subgraphs:
            raise SpecificationBuilderException(
                f'Subgraph {subgraph["name"]} already exists.'  # noqa: E501
            )
        self._subgraphs[subgraph["name"]] = subgraph

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
            self._metadata["interfaces"] = dict()
        if interfacename in self._metadata["interfaces"]:
            raise SpecificationBuilderException(
                f"Styling for interface {interfacename} already exists."
            )
        props = dict()
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
        """
        for include in otherspec.get("include", []):
            include = requests.get(include).json()
            self.update_spec_from_other(include)
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
        for node in otherspec.get("nodes", []):
            self.add_node_type_from_spec(node)
        for subgraph in otherspec.get("subgraphs", []):
            self.add_subgraph_from_spec(subgraph)

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

        sorted_tuples = sorted(self._nodes.items())
        return list(zip(*sorted_tuples))[1]

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

    def _sorted_subgraphs(self) -> List[Dict]:
        """
        Sorts subgraph entries in the specification and returns them.

        Returns
        -------
        List[Dict]
            A list of dictionaries describing subgraphs.
        """
        sort_dict_list(self._subgraphs, "nodes", sort_by="name")
        for graph in self._subgraphs.values():
            sort_dict_list(graph, "connections", sort_by="from")
            sort_dict_list(graph, "interfaces", sort_by="name")
            sort_dict_list(graph, "nodes", sort_by="name")

            if "nodes" in graph:
                for node in graph["nodes"]:
                    sort_dict_list(node, "interfaces", sort_by="name")
                    sort_dict_list(node, "properties", sort_by="name")

        sorted_tuples = sorted(self._subgraphs.items())
        return list(zip(*sorted_tuples))[1]

    def _get_metadata(self, sort_spec: bool) -> Dict:
        if sort_spec:
            return self._sorted_metadata()
        return self._metadata

    def _get_nodes(self, sort_spec: bool) -> List[Dict]:
        if sort_spec:
            return self._sorted_nodes()
        return list(self._nodes.values())

    def _get_subgraphs(self, sort_spec: bool) -> List[Dict]:
        if sort_spec:
            return self._sorted_subgraphs()
        return list(self._subgraphs.values())

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
        if self._subgraphs:
            spec["subgraphs"] = self._get_subgraphs(sort_spec)
        return spec

    def create_and_validate_spec(
        self,
        workspacedir: Optional[Path] = None,
        resolved_specification: Optional[Path] = None,
        fail_on_warnings: bool = True,
        sort_spec: bool = False,
        dump_spec: Optional[Path] = None,
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
