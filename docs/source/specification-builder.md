# Specification builder

Creating specification for external applications is provided by Pipeline Manager in the form of `SpecificationBuilder` class.
Using the tool not only ensures a unified, simplified creation process, but also includes sanity checks to guarantee a valid specification.

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
    categoryparent='Filters'
)
```

### Adding interfaces to node types

The following snippet will add a few interfaces to the existing nodes:

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
    interfacetype='video',
    direction='input'
)

specification_builder.add_node_type_interface(
    name='Filter',
    interfacename='Output',
    interfacetype='filtered_output',
    direction='output',
)
```








