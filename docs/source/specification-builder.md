# Specification builder

Creating a specification, especially in external applications written in Python, can be significantly simplified with the `SpecificationBuilder` class.
This tool:

* Provides methods to update the contents of the specification
* Provides an API that allows modifying the specification without worrying about the changes in the format
* Provides sanity checks of URLs, prevents duplicates and validates the specification with the frontend.

Note that this chapter only presents the initial steps of constructing a specification in Pipeline Manager.
Check the [specification format](./specification-format.md) for some more comprehensive details.

## Example usage of the `SpecificationBuilder`

### Creating the builder

Import the package, specify the specification version to use and create an instance:

```python
from pathlib import Path
from pipeline_manager.specification_builder import SpecificationBuilder

SPECIFICATION_VERSION = '20240723.13'
ASSETS_DIRECTORY = Path("./assets")

specification_builder = SpecificationBuilder(
    spec_version=SPECIFICATION_VERSION,
    assets_dir=ASSETS_DIRECTORY,
    check_urls=True
)
```

`assets_dir` is a path to additional assets (icons, visualizations) - it is used during validation to inform the user that e.g. paths provided in the specification do not have corresponding files.
`check_urls` determines whether the `SpecificationBuilder` should check URLs provided in the specification for availability and raise errors when pages are not found.

### Creating node types

Node types can be created with:

```python
specification_builder.add_node_type(
    name='Digital camera',
    category='Video provider'
)
```

This method requires a unique name of the node type.
We can also specify category, parent classes, layer and abstract fields.
Follow the documentation of the class for more details.


### Add node type "as category"

To create a node type that can act as a category grouping the child node types, we can use `add_node_type_as_category`:

```python
specification_builder.add_node_type_as_category(
    categoryname='Filter',
)
```

To add a node that extends this node type as category, just provide its name in the `extends` field in the child node:

```python
specification_builder.add_node_type(
    name='GaussianFilter',
    extends='Filter'
)
```

### Adding interfaces to node types

The following snippets show how to add interfaces to node types.
Note that one or more values can be passed to the `interfacetype` argument, signifying which types of other interfaces can be connected to it.

```python
specification_builder.add_node_type_interface(
    name='Digital camera',
    interfacename='Video output',
    interfacetype='video',
    direction='output'
)

specification_builder.add_node_type_interface(
    name='Filter',
    interfacename='Video',
    interfacetype=['video', 'filtered_output'],
    direction='input'
)

specification_builder.add_node_type_interface(
    name='Filter',
    interfacename='Output',
    interfacetype='filtered_output',
    direction='output',
)
```

### Adding properties to node types

To create a property in Pipeline Manager, we need to pass three required arguments:

- `name` - the name of the property
- `type` - the type of the property, which has nine possible values:
  - `text`, `constant`, `number`, `integer`, `select`, `bool`, `slider`, `list`, `hex`,
- `default` - specifies a default value, its type depends on the `type` of the property


```python
specification_builder.add_node_type_property(
    name='Digital camera',
    propname='Focal length',
    proptype='slider',
    min=14,
    max=135,
    default=50,
    description='Value signifying a camera\'s angle of view'
)

specification_builder.add_node_type_property(
    name='Filter',
    propname='Kernel size',
    proptype='select',
    values=['3x3', '5x5', '7x7'],
    default='3x3',
    description='Small matrix used for convolution'
)
```

There are some additional arguments, available in the [specification format](./specification-format.md#property).

### Adding node type descriptions

Adding descriptions is just a matter of providing a node name and a description string.

```python
specification_builder.add_node_description(
    name='Digital camera',
    description='Camera providing digital video output'
)
```

### Adding metadata

Metadata specifies additional editor options, like `connectionStyle` or `movementStep`.
All parameters are defined in the [specification format](./specification-format.md#metadata).

```python
specification_builder.metadata_add_param(
    paramname='connectionStyle',
    paramvalue='orthogonal'
)
```

### Adding URLs to node types

To add a URL, first specify the URL group, which is part of the metadata.
The icon argument can be a path to an asset file or a link.

```python
specification_builder.metadata_add_url(
    groupname='wikipedia',
    displayname='Wikipedia',
    icon='https://en.wikipedia.org/static/favicon/wikipedia.ico',
    url='https://en.wikipedia.org/'
)
```

Then, add the node URL by defining the suffix that will be appended to the group URL.

```python
specification_builder.add_node_type_url(
    name='Digital camera',
    urlgroup='wikipedia',
    suffix='wiki/Digital_camera'
)
```

### Constructing and validating the specification

This function will generate and check the validity of the specification:

```python
specification = specification_builder.create_and_validate_spec()
```

The possible arguments are:

- `workspacedir` - The path to the workspace directory for Pipeline Manager, the same that has been provided for the build script
- `fail_on_warnings` - Determines whether the validation should fail on warnings
- `dump_spec` - A path to where the specification should be dumped as a file before validation.
  Useful for debugging purposes.
- `sort_spec` - Return specification that has introduced ordering to dictionaries and lists.
  In lists containing dictionaries the unique field of each dictionary is used to sort entries.

The created `specification` upon successful run should contain a full specification based on `SpecificationBuilder`.
It is a regular Python dictionary that can be saved to a JSON file using the `json.dump` method.

`````{note}
To make sure the entries in the specification are sorted (mostly dictionaries) after using `sort_spec`, in case of Python's `json.dump` and `json.dumps` methods use `sort_keys=True`, e.g.:

```python
json.dumps(spec, sort_keys=True, indent=4)
```
`````

## `SpecificationBuilder` documentation

```{eval-rst}
.. autoclass:: pipeline_manager.specification_builder.SpecificationBuilder
   :members:
```
