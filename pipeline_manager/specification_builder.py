# Copyright (c) 2020-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Module for constructing the specification for the Pipeline Manager.

Can be used by other applications to quickly form the specification
for the Pipeline Manager server.
"""

import requests
from typing import Optional, Dict, Any, List, Union
from urllib3.exceptions import (
    MaxRetryError, ConnectTimeoutError, ReadTimeoutError
)
import json
from pathlib import Path
from pipeline_manager.validator import validate


class SpecificationBuilderException(Exception):
    """
    Is raised when any inconsistency in the specification generation
    is spotted.
    """
    pass


def get_optional(
        entry: Optional[Dict],
        key: Optional[Any] = None) -> Optional[Any]:
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
    Optional[Any]:
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
            check_urls: bool = False):
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
        self._nodes = dict()
        self._nodelayers = set()
        self._categories = set()
        self._subgraphs = dict()
        self._metadata = dict()
        self.check_urls = check_urls
        self.warnings = 0
        self.assets_dir = Path(assets_dir) if assets_dir else None

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
        """
        if ("category" in self._nodes[name] and
                category != self._nodes[name]["category"]):
            raise SpecificationBuilderException(
                f"Cannot set '{name}' category to {category}: there is already"
                f" a {self._nodes[name]['category']} category defined"
            )
        self._nodes[name]["category"] = category
        self.register_category(category)

    def add_node_type_parent(
            self,
            name: str,
            parent_names: Union[str, List[str]]):
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
        """
        if type(parent_names) is str:
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
            layer: Optional[str] = None,
            category: Optional[str] = None,
            extends: Optional[Union[str, List[str]]] = None):
        """
        Adds a node type to the specification.

        Parameters
        ----------
        name: str
            Name of the node type
        layer: Optional[str]
            Name of the layer metatype
        category: Optional[str]
            Category of the node
        extends: Optional[Union[str, List[str]]]
            Base classes for the node type
        """
        if name in self._nodes:
            raise SpecificationBuilderException(
                f"Redefined node type:  {name}"
            )
        self._nodes[name] = {"name": name, "interfaces": [], "properties": []}
        if extends:
            self.add_node_type_parent(name, extends)
        if layer:
            self._nodes[name]["layer"] = layer
            self._nodelayers.add(layer)
        if category:
            self.add_node_type_category(name, category)

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
        """
        if "description" in self._nodes[name]:
            raise SpecificationBuilderException(
                f"The description for {self._nodes[name]} already defined: ${self._nodes[name]['description']}"  # noqa: E501
            )
        self.set_node_description(name, description)

    def get_node_description(self, name):
        """
        Gets description for the node type.

        Parameters
        ----------
        name: str
            Name of the node type
        """
        if name not in self._nodes or "description" not in self._nodes[name]:
            return ""
        return self._nodes[name]["description"]

    def add_node_type_icon(self, name: str, iconpath: Union[dict, str]):
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

        full_url = None

        if isinstance(iconpath, dict):
            if len(iconpath) != 1:
                raise SpecificationBuilderException(
                    f"Icon with prefix {json.dumps(iconpath)} for node type {name} can only have one element"  # noqa: E501
                )
            group, suffix = list(iconpath.items())[0]
            if (not self._metadata or "icons" not in
                    self._metadata or group not in self._metadata["icons"]):
                raise SpecificationBuilderException(
                    f"Icons class {group} is not available in metadata"
                )
            full_url = self._metadata['icons'][group] + suffix
        elif isinstance(iconpath, str):
            full_url = iconpath
        else:
            raise SpecificationBuilderException(
                f"Icon with prefix {iconpath} for node type {name} has invalid format"  # noqa: E501
            )

        if self.check_urls:
            try:
                response = requests.head(
                    full_url,
                    timeout=4,
                    allow_redirects=True
                )
                if response.status_code != 200:
                    print(
                        f'WARN: Icon for node type {name} does not work (HTTP status: {response.status_code}):  {full_url}'  # noqa: E501
                    )
                    self.warnings += 1
            except (
                    requests.ConnectTimeout,
                    requests.exceptions.ReadTimeout,
                    MaxRetryError,
                    TimeoutError,
                    ReadTimeoutError,
                    ConnectTimeoutError):
                print(
                    f'WARN: Icon for node type {name} does not work (timeout):  {full_url}'  # noqa: E501
                )
                self.warnings += 1
            except requests.exceptions.MissingSchema:
                print(
                    f'WARN: Icon for node type {name} has invalid URL:  {full_url}'  # noqa: E501
                )
                self.warnings += 1
            except Exception as ex:
                print(
                    f'WARN: Failed to check icon URL:  {full_url}'
                )
                print(ex)
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
        """
        if "urls" not in self._nodes[name]:
            self._nodes[name]["urls"] = {}
        if (not self._metadata or "urls" not in
                self._metadata or urlgroup not in self._metadata["urls"]):
            raise SpecificationBuilderException(
                f"URL class {urlgroup} is not available in metadata"
            )
        if self.check_urls:
            full_url = self._metadata['urls'][urlgroup]['url'] + suffix
            response = requests.head(full_url, timeout=4, allow_redirects=True)
            try:
                if response.status_code != 200:
                    print(
                        f'WARN: URL for node type {name} does not work (HTTP status: {response.status_code}):  {full_url}'  # noqa: E501
                    )
                    self.warnings += 1
            except (
                    requests.ConnectTimeout,
                    requests.exceptions.ReadTimeout,
                    MaxRetryError,
                    TimeoutError,
                    ReadTimeoutError,
                    ConnectTimeoutError):
                print(
                    f'WARN: URL for node type {name} does not work (timeout):  {full_url}'  # noqa: E501
                )
                self.warnings += 1
            except Exception as ex:
                print(
                    f'WARN: Failed to check URL:  {full_url}'
                )
                print(ex)
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
            interfacetype: Union[str, List[str]],
            direction: str,
            side: Optional[str] = None,
            maxcount: Optional[int] = None):
        """
        Adds interface to the node type.

        Parameters
        ----------
        name: str
            Name of the node type
        interfacename: str
            Name of the interface
        interfacetype: Union[str, List[str]]
            List of matching types for interfaces
        direction: str
            Direction of the connection
        side: Optional[str]
            On which side the interface should be placed by default
        maxcount: Optional[int]
            The maximum connections to the given interface
        """
        if 'interfaces' not in self._nodes[name]:
            self._nodes[name]['interfaces'] = []

        if any([entry['name'] == interfacename and entry['direction'] == side
                for entry in self._nodes[name]['interfaces']]):
            raise SpecificationBuilderException(
                f'Interface of the same direction ({side}) and name '
                f'({interfacename}) already exists in {name}'
            )

        assert direction in ["input", "output", "inout"]
        assert side in [None, "left", "right"]

        interface = {
            "name": interfacename,
            "type": [typ.lower() for typ in interfacetype] if isinstance(interfacetype, list) else interfacetype.lower(),  # noqa: E501
            "direction": direction
        }

        set_if_not_none(interface, "side", side)
        set_if_not_none(interface, "maxConnectionsCount", maxcount)

        self._nodes[name]['interfaces'].append(interface)

    def create_property(
            self,
            propname: str,
            proptype: str,
            default: Any,
            description: Optional[str] = None,
            min: Any = None,
            max: Any = None,
            values: Optional[List[Any]] = None,
            dtype: Optional[str] = None) -> dict:
        """
        Creates and returns a property

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
        """

        prop = {
            "name": propname,
            "type": proptype,
            "default": default
        }

        set_if_not_none(prop, 'description', description)
        set_if_not_none(prop, 'min', min)
        set_if_not_none(prop, 'max', max)
        set_if_not_none(prop, 'values', values)
        set_if_not_none(prop, 'dtype', dtype)

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
            dtype: Optional[str] = None):
        """
        Adds a property to a property group

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
        """

        if 'properties' not in self._nodes[name] or all(
                entry['name'] != propgroupname
                for entry in self._nodes[name]['properties']):
            raise SpecificationBuilderException(
                f'Property {propgroupname} does not exits'
            )

        prop = self.create_property(
            propname,
            proptype,
            default,
            description,
            min,
            max,
            values,
            dtype
        )

        for entry in self._nodes[name]['properties']:
            if entry['name'] == propgroupname:
                if 'group' not in entry:
                    entry['group'] = []
                entry['group'].append(prop)

        self._nodes[name]['properties'].append(prop)

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
            dtype: Optional[str] = None):
        """
        Adds property to the node

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
        """
        if 'properties' not in self._nodes[name]:
            self._nodes[name]['properties'] = []

        if any([entry['name'] == propname
                for entry in self._nodes[name]['properties']]):
            raise SpecificationBuilderException(
                f'Property of the same name ({propname}) already exists in {name}'  # noqa: E501
            )

        prop = self.create_property(
            propname,
            proptype,
            default,
            description,
            min,
            max,
            values,
            dtype
        )
        self._nodes[name]['properties'].append(prop)

    def add_node_type_from_spec(self, node):
        """
        Adds single node type defined in JSON-like format.
        """
        if "name" not in node:
            raise SpecificationBuilderException(
                "The given node specification is invalid - it is "
                "missing the 'name' field\n"
                f"{json.dumps(node, indent=4)}"
            )
        self.add_node_type(
            node["name"],
            node["layer"] if "layer" in node else None,
            node["category"] if "category" in node else None,
            node["extends"] if "extends" in node else None
        )
        if "icon" in node:
            self.add_node_type_icon(node["name"], node["icon"])
        if "urls" in node:
            for urlgroup, urlsuffix in node["urls"].items():
                self.add_node_type_url(node["name"], urlgroup, urlsuffix)
        if "additionalData" in node:
            self.add_node_type_additional_data(
                node["name"],
                node["additionalData"]
            )
        if "description" in node:
            self.add_node_description(
                node["name"],
                node["description"]
            )
        if "interfaces" in node:
            for interface in node["interfaces"]:
                self.add_node_type_interface(
                    node["name"],
                    interface["name"],
                    [typ.lower() for typ in interface["type"]] if isinstance(interface["type"], list) else interface["type"].lower(),  # noqa: E501
                    interface["direction"],
                    get_optional(interface, "side"),
                    get_optional(interface, "maxConnectionsCount")
                )
        if "properties" in node:
            for property in node["properties"]:
                self.add_node_type_property(
                    node["name"],
                    property["name"],
                    property["type"],
                    property["default"],
                    get_optional(property, "description"),
                    get_optional(property, "min"),
                    get_optional(property, "max"),
                    get_optional(property, "values"),
                    get_optional(property, "dtype")
                )
                if 'group' in property:
                    for childprop in property['group']:
                        self.add_node_type_property_group(
                            node['name'],
                            property['name'],
                            childprop["name"],
                            childprop["type"],
                            childprop["default"],
                            get_optional(childprop, "description"),
                            get_optional(childprop, "min"),
                            get_optional(childprop, "max"),
                            get_optional(childprop, "values"),
                            get_optional(childprop, "dtype")
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
            interfaceconncolor: Optional[str] = None):
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
        if 'interfaces' not in self._metadata:
            self._metadata['interfaces'] = dict()
        if interfacename in self._metadata['interfaces']:
            raise SpecificationBuilderException(
                f'Styling for interface {interfacename} already exists.'
            )
        props = dict()
        set_if_not_none(props, 'interfaceColor', interfacecolor)
        set_if_not_none(
            props,
            'interfaceConnectionPattern',
            interfaceconnpattern
        )
        set_if_not_none(props, 'interfaceConnectionColor', interfaceconncolor)
        if props:
            self._metadata['interfaces'][interfacename] = props

    def metadata_add_layer(
            self,
            name: str,
            nodelayers: Optional[Union[str, List[str]]] = None,
            nodeinterfaces: Optional[Union[str, List[str]]] = None):
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
        """
        if 'layers' not in self._metadata:
            self._metadata['layers'] = []

        assert nodelayers or nodeinterfaces

        if any([entry['name'] == name for entry in self._metadata['layers']]):
            raise SpecificationBuilderException(
                f'Layer {name} already exists.'
            )
        entry = {'name': name}
        set_if_not_none(entry, 'nodeLayers', nodelayers)
        set_if_not_none(entry, 'nodeInterfaces', nodeinterfaces)

        if 'nodeInterfaces' in entry:
            entry['nodeInterfaces'] = [
                intf.lower() for intf in entry['nodeInterfaces']
            ]
        self._metadata['layers'].append(entry)

    def metadata_add_url(
            self,
            groupname: str,
            displayname: str,
            icon: str,
            url: str):
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
        """
        if 'urls' not in self._metadata:
            self._metadata['urls'] = {}

        entry = {
            "name": displayname,
            "icon": icon,
            "url": url
        }

        if groupname in self._metadata['urls'] and self._metadata['urls'][groupname] != entry:  # noqa: E501
            raise SpecificationBuilderException(
                f'URL group {groupname} already exists and is different:\n'
                f'Current:\n{self._metadata["urls"][groupname]}\nNew:\n{entry}'
            )

        self._metadata['urls'][groupname] = entry

    def metadata_add_param(
            self,
            paramname: str,
            paramvalue: Any):
        """
        Sets parameter in metadata.

        Parameters
        ----------
        paramname: str
            Name of the metadata parameter
        paramvalue: Any
            Value of the parameter
        """
        if (paramname in self._metadata and
                self._metadata[paramname] != paramvalue):
            raise SpecificationBuilderException(
                f'Changing metadata parameter {paramname}: {self._metadata[paramname]} to {paramvalue}'  # noqa: E501
            )
        self._metadata[paramname] = paramvalue

    def update_spec_from_other(self, otherspec: Any):
        """
        Updates the specification from other specification.
        It can be also used to merge partial specifications.

        Parameters
        ----------
        otherspec: Any
            JSON-like structure with other specification
        """
        if 'metadata' in otherspec:
            metadata = otherspec['metadata']
            for prop, propvalue in metadata.items():
                if prop == 'interfaces':
                    for interfacename, interfacestyle in propvalue.items():
                        self.metadata_add_interface_styling(
                            interfacename.lower(),
                            get_optional(interfacestyle, 'interfaceColor'),
                            get_optional(interfacestyle, 'interfaceConnectionPattern'),  # noqa: E501
                            get_optional(interfacestyle, 'interfaceConnectionColor')  # noqa: E501
                        )
                elif prop == 'urls':
                    for urlname, urlentry in propvalue.items():
                        self.metadata_add_url(
                            urlname,
                            urlentry['name'],
                            urlentry['icon'],
                            urlentry['url']
                        )
                elif prop == 'layers':
                    for layer in propvalue:
                        self.metadata_add_layer(
                            layer['name'],
                            get_optional(layer, 'nodeLayers'),
                            get_optional(layer, 'nodeInterfaces')
                        )
                else:
                    self.metadata_add_param(prop, propvalue)
        if 'nodes' in otherspec:
            for node in otherspec['nodes']:
                self.add_node_type_from_spec(node)
        if 'subgraphs' in otherspec:
            for subgraph in otherspec['subgraphs']:
                self.add_subgraph_from_spec(subgraph)

    def _construct_specification(self):
        """
        Builds specification from the builder data.
        """
        spec = {"version": self.version}
        spec["nodes"] = list(self._nodes.values())
        if self._metadata:
            spec["metadata"] = self._metadata
        if self._subgraphs:
            spec["subgraphs"] = list(self._subgraphs.values())
        return spec

    def create_and_validate_spec(
            self,
            workspacedir: Optional[Path] = None,
            fail_on_warnings: bool = True):
        """
        Creates a specification and validates it using schema.

        Parameters
        ----------
        workspacedir: str
            Path to the workspace directory for Pipeline Manager
        fail_on_warnings: bool
            Tells if the specification creation should fail on warnings
        """
        import tempfile
        spec = self._construct_specification()

        if workspacedir:
            workspacedir = Path(workspacedir)

        with tempfile.TemporaryDirectory() as tmpdir:
            specpath = Path(tmpdir) / 'spec.json'
            with open(Path(tmpdir) / 'spec.json', 'w') as spec_file:
                json.dump(spec, spec_file)
            res = validate(
                specification_path=specpath,
                workspace_directory=workspacedir
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
        return spec
