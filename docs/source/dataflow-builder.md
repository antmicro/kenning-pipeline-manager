# Dataflow graph builder

Class `DataflowBuilder` (available in `pipeline_manager.dataflow_builder.dataflow_builder`) provides a convenient Python API for creating and editing a dataflow graph.

## Examples of DataflowBuilder usage

### Creating DataflowBuilder

In order to create an instance of `DataflowBuilder`:
```python
from pipeline_manager.dataflow_builder.dataflow_builder import DataflowBuilder

builder = DataflowBuilder(
    specification="examples/sample-specification.json",
    specification_version="20240723.13",
)
```

The code creates an instance of `DataflowBuilder` with the `sample-specification.json` loaded.

### Obtaining a dataflow graph

A dataflow graph may be either loaded from a dataflow file or created.

To create a new empty dataflow graph:
```python
graph = builder.create_graph()
```

To load an existing specification from a file:
```python
builder.load_graphs(dataflow_path='examples/sample-dataflow.json')
graph = builder.graphs[0]
```

In both cases, the dataflow graph:
- has to be compliant with the provided specification.
- is retrieved and may be edited with its public methods.

### Creating a node

Having obtained the `DataflowGraph` object (in the previous examples, stored in the `graph` variable), a new node may be added to the graph in the following way:
```python
node = graph.create_node(
    name="LoadVideo", # Required.
    position=Vector2(0, 0), # Optional.
)
```

Only keyword parameters are allowed. The available parameters of the `create_node` method are attributes of the `Node` dataclass (which is located under `pipeline_manager.dataflow_builder.entities.Node`).

### Getting a node

A dataflow graphs stores nodes. Thus, nodes are retrieved from the dataflow graph in the following way:
```python
nodes = graph.get(AttributeType.NODE, name="LoadVideo")
if len(nodes) > 0:
    node = nodes[0]
```

Only nodes with `name` equal to `LoadVideo` will be retrieved.

The `DataflowGraph.get` method retrieves not only nodes but other objects present in the `AttributeType` enum: connections, interfaces, and nodes. In this case, nodes are retrieved. Parameters other than `type` are filters, which specify what values should the obtained objects (here: nodes) have. Take a look at the next example to see such usage.

### Getting a node matching multiple criteria

To get a node, which satisfies all the matching criteria, use the `get` method once again:
```python
[node] = graph.get(AttributeType.Node, position=Vector2(0, 0), name="LoadVideo")
```

The code above puts in the `node` variable a node with name `LoadVideo` and position with coordinates `[0, 0]`.

### Manipulating a node

After having a node retrieved from a graph, it is time to modify its attributes. For example, if a user wanted to assign an instance name to the node, she or he should do it directly:
```python
node.instance_name = 'Instance name of a node'
```

On the other hand, if a user wanted to alter a property (from the list of `properties` of a node), she or he should use an indirect method:
```python
try:
    # Use of `set_property` is recommended to set values of properties of a node.
    node.set_property('compression_rate', 1)
except KeyError:
    print('Cannot set compression_rate to 1 as the property does not exists.')
```

Yet another example depicts moving a node:
```python
# Move the node by 500 pixels to the right, relative to its previous position.
node.move(new_position=Vector2(500, 0), relative=True)
```

However, if a user wants to move to an absolute position, the following code should be used:
```python
# Move a node to [1000, 1000].
node.move(Vector(1000, 1000)) # relative = False, by default
```

## Specification of DataflowBuilder

```{eval-rst}
.. autoclass:: pipeline_manager.dataflow_builder.dataflow_builder.DataflowBuilder
  :members:
```

## Specification of DataflowGraph

```{eval-rst}
.. autoclass:: pipeline_manager.dataflow_builder.dataflow_graph.DataflowGraph
  :members:
```

## Specification of Node

```{eval-rst}
.. autoclass:: pipeline_manager.dataflow_builder.entities.Node
  :members:
```

## Specification of Interface

```{eval-rst}
.. autoclass:: pipeline_manager.dataflow_builder.entities.Interface
  :members:
```

## Specification of Connection

Notice that name of the class representing connection is `InterfaceConnection`, not `Connection`.

```{eval-rst}
.. autoclass:: pipeline_manager.dataflow_builder.entities.InterfaceConnection
  :members:
```

## Specification of Property

```{eval-rst}
.. autoclass:: pipeline_manager.dataflow_builder.entities.Property
  :members:
```
