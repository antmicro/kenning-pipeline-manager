# Specification builder

Creating specification for external applications is provided by Pipeline Manager in the form of `SpecificationBuilder` class.
Using the tool not only ensures a unified, simplified creation process, but also includes sanity checks to guarantee a valid specification.

Note that this article only presents the initial steps of constructing a specification in Pipeline Manager.
Check out the [specification format](./specification-format.md) for some more comprehensive details.

## Usage

Specification builder is available as a Python module. 
Import the package, specify the specification version to use and create an instance:

```python
from pipeline_manager.specification_builder import SpecificationBuilder

SPECIFICATION_VERSION = '20230830.11'

specification_builder = SpecificationBuilder(
    SPECIFICATION_VERSION,
)
```

### Creating node types

Node types are a fundamental part of Pipeline Manager's specification. Create them like this:

```python
specification_builder.add_node_type(
    name='Digital camera',
    category='Video provider',
)
```

Note that specifying the category while creating a node automatically creates that category.

### Constructing and validating the specification

This function will generate and check the validity of the specification:

```python
specification = specification_builder.create_and_validate_spec()
```

The possible arguments are:

- `workspacedir` - The path to the workspace directory for Pipeline Manager
- `fail_on_warnings` - Whether the creation process should fail on warnings
- `dump_spec` - A path to where the specification should be dumped as a file before validation.
  Useful for debugging purposes.

### Add node type as category

This way the node will be a 'category' - enabling it to encompass some child nodes. Note that the node can still be dragged and shown in the editor.

```python
specification_builder.add_node_type_as_category(
    categoryname='Filter',
)
```

To add a node that extends this base class / category

```python
specification_builder.add_node_type(
    name='GaussianFilter',
    category='Filter',
    extends='Filter',
)
```

### Adding interfaces to node types

The following snippet will add a few interfaces to the existing nodes.
Note that one ore more values can be passed to the `interfacetype` argument, signifying which types of other interfaces can be connected to it.

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

To create a property in Pipeline Manager, you need to pass three required arguments:

- `name` - the name of the property
- `type` - the type of the property, which has nine possible values:
  - `text`, `constant`, `number`, `integer`, `select`, `bool`, `slider`, `list`, `hex`,
- `defaut` - specifies a default value, its tye depends on the `type` of the property

There are some additional arguments, available in the [specification format](./specification-format.md#property)

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

### Adding node type descriptions

Adding descriptions is just a case of providi ng a node name and a description string.

```python
specification_builder.add_node_description(
    name='Digital camera',
    description='Camera providing digital video output'
)
```

### Adding metadata

Metadata specifies additional editor options, like `connectionStyle` or `movementStep`. All options are available in the [specification format](./specification-format.md#metadata)

```python
specification_builder.metadata_add_param(
    paramname='connectionStyle',
    paramvalue='orthogonal'
)
```

### Adding URLs to node types

To add a URL, first specify the URL group, which will be part of the metadata. The icon argument can be a path to an asset file or a link.

```python
specification_builder.metadata_add_url(
    groupname='wikipedia',
    displayname='Wikipedia',
    icon='https://en.wikipedia.org/static/favicon/wikipedia.ico',
    url='https://en.wikipedia.org/'
)
```

Then, add the node URL, defining the suffix that would be appended to the group URL.

```python
specification_builder.add_node_type_url(
    name='Digital camera',
    urlgroup='wikipedia',
    suffix='wiki/Digital_camera'
)
```
