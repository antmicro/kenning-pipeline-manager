# Specification format

{{project}} requires a JSON specification that defines the working environment.
It specifies all nodes, properties, available connections, and metadata for the editor.
It can be either provided from a file or fetched from an [external application](external-app-communication).

Such a specification defining the nodes needs to be loaded through the front end in order for you to be able to load any dataflow.

## Format description

The specification needs to be provided in a JSON file.
There are two main attributes.

* `metadata` - object of type [Metadata](#metadata) that specifies editor styling and metadata
* `nodes` - array that specifies valid nodes, where every element is of type [Node](#node).

### Metadata

This object specifies additional editor options and contains the following optional properties:

* `interfaces`  - dictionary which defines interface styling in the nodes.
  Colors can be specified by a hexadecimal value or by name.
* `allowLoopbacks` - boolean value that determines whether connections with endpoints at the same node are allowed.
  Default value is `false`.
* `readonly` - boolean value determining whether the editor is in read-only mode.
  In read-only mode, the user cannot create or remove nodes and connections.
  Modification of any properties is also disabled.
  The user is only allowed to load existing dataflows.
  Default value is `false`.
* `twoColumn` - boolean value determining the layout of the nodes.
  If set to `true`, then input and output sockets are both rendered in the top part of the node and properties are displayed below.
  Default value is `false`.
* `connectionStyle` - string value that determines the connection style.
  Can choose one out of the two options: `curved` or `orthogonal`.
  Default value is `curved`
* `hideHud` - boolean value determining whether UI elements should be hidden. Components affected by this flag are: popup notifications, navigation bar and terminal window.
  Default value is `false`
* `layers` - layers specyfing groups of interfaces and nodes that can be hidden in the viewer from settings level.
  The entries are of type [Layer](#layers).
  By default there are no layers.

An example:

```json
"metadata": {
    "interfaces": {
        "Dataset": "#FF0000"
    },
    "allowLoopbacks": false,
    "readonly": true,
    "connectionStyle": "orthogonal",
    "hideHud": false,
    "layers": [
        {
            "name": "Example Layer",
            "nodeTypes": ["processing"],
            "nodeInterfaces": ["BinaryImage"]
        }
    ]
}
```

#### Layer

Layer is used to describe a set of types of nodes and interfaces.
Layers can be used to hide nodes of given types.
They can be also used to hide connections for given interface types.

The layers can be enabled or disabled in editor settings.

Every layer has three properties (at least `name` and one of `nodeTypes` or `nodeInterfaces` need to be defined):

* `name` - name of the layer displayed in the editor,
* `nodeTypes` (optional) - array of names of node types that belong to the layer,
* `nodeInterfaces` (optional) - array of names of interface types that belong to the layer.

### Node

This object specifies a single node.
Every input object requires six properties:

* `name` - name displayed in the editor.
* `type` - value used for styling.
* `category` - context menu category displayed in the editor.
* `icon` - name of an SVG icon that is going to be displayed next to the name of the node.
  The icons have to be placed in the `assets` directory in the built frontend (default is `pipeline_manager/frontend/dist/assets`).
  The path in `icon` should be the path within the `assets` directory, e.g. `filter.svg` for `pipeline_manager/frontend/dist/assets/filter.svg`.
  ``````{note}
  The `assets` directory can be created and filled manually or added by `build` script with `--assets-directory <path-to-directory-with-icons>`, e.g.:
  ```bash
  ./build --assets-directory examples/sample-assets static-html static-html examples/sample-specification.json
  ```
  ``````
* `interfaces` - array representing inputs, outputs and bidirectional ports for node.
  The entries are of type [Interface](#interface).
* `properties` - array with elements of type [Property](#property).

Here is an example of a node:

```json
{
    "name": "Filter2D",
    "type": "filters",
    "category": "Filters",
    "icon": "filter.svg",
    "properties": [
        {
            "name": "iterations",
            "type": "integer",
            "default": 1
        },
        {
            "name": "border type",
            "type": "select",
            "values": ["constant", "replicate", "wrap", "reflect"],
            "default": "constant"
        }
    ],
    "interfaces": [
        {
            "name": "image",
            "type": "Image",
            "direction": "input"
        },
        {
            "name": "kernel",
            "type": "Image",
            "direction": "input"
        },
        {
            "name": "output",
            "type": "Image",
            "direction": "output"
        }
    ]
}
```

#### Interface

An object that specifies a single input, output or inout interface of node.
Every interface object has following properties:

* `name` - name of the input displayed in the editor
* `type` - type of the input used for styling and validation purposes.
* `direction` - type of the interface in terms of direction, it can be:

    * `input` - interface accepts input data,
    * `output` - interface returns output data.
    * `inout` - interface can both produce outputs and receive inputs.
* `maxConnectionsCount` (optional) - specifies the maximum allowed number of connections for a given port.
  Value less than 0 means no limit for connections for a given interface.
  Value equal to 0 means default behavior - one allowed connection to inputs, many allowed connections from outputs.
  The default value is 0.
* `connectionSide` (optional) - specifies the side on which the interface is rendered.
  Value can be either `left` or `right`.
  Interfaces with `direction` set to `input` or `inout` are by default rendered on the left side of the node.
  Interfaces with `direction` set to `output` are by default rendered on the right side of the node.

```{note}
Only interfaces of the same `type` can be connected together.
```

#### Property

An object that specifies a single property.
Every project object has two required base properties:
* `name` - name of the property.
* `type` - type of the property.

There are eight possible values for the `type` property.
* `text` - property is a string.
  A text field is displayed to the user.
* `constant` - property is a string.
  A non-modifiable text field is displayed to the user.
* `number` - property is a float.
  A number field is displayed to the user.
* `integer` - property is an int.
  A number field that only accepts integers is displayed to the user.
* `select` - property is a string with a defined range.
  It requires a `values` property.
* `checkbox` - property is a bool.
  It requires a `default` property.
* `slider` - property is a float with a specified range.
  It requires `min` and `max` properties.
* `list` - property is a list of arguments of the same type, which can be specified using `dtype`.


Additional properties:

* `min` - specifies the left end of a range.
* `max` - specifies the right end of a range.
* `default` - specifies a default selected value.
  Its type depends on the `type` chosen.
* `values` - specifies a range of possible values for `select`.
* `dtype` - specifies data type of elements in a `list`.
  Supported values are `string`, `number`, `integer`, `boolean`.
* `description` - description of the property.
  In some cases, it can be displayed to the user.

## Example

Below, you can see a sample specification containing a hypothetical definition of nodes for image processing purposes:

```json
{
    "nodes": [
        {
            "name": "LoadVideo",
            "type": "filesystem",
            "category": "Filesystem",
            "properties": [
                {"name": "filename", "type": "text", "default": ""}
            ],
            "inputs": [],
            "outputs": [{"name": "frames", "type": "Image"}]
        },
        {
            "name": "SaveVideo",
            "type": "filesystem",
            "category": "Filesystem",
            "properties": [
                {"name": "filename", "type": "text", "default": ""}
            ],
            "inputs": [
                {"name": "color", "type": "Image"},
                {"name": "binary", "type": "BinaryImage"}
            ],
            "outputs": []
        },
        {
            "name": "GaussianKernel",
            "type": "kernel",
            "category": "Generators",
            "properties": [
                {"name": "size", "type": "integer", "default": 5},
                {"name": "sigma", "type": "number", "default": 1.0}
            ],
            "inputs": [],
            "outputs": [{"name": "kernel", "type": "Image"}]
        },
        {
            "name": "StructuringElement",
            "type": "kernel",
            "category": "Generators",
            "properties": [
                {"name": "size", "type": "integer", "default": 5},
                {
                    "name": "shape",
                    "type": "select",
                    "values": ["Rectangle", "Cross", "Ellipse"],
                    "default": "Cross"
                }
            ],
            "inputs": [],
            "outputs": [{"name": "kernel", "type": "BinaryImage"}]
        },
        {
            "name": "Filter2D",
            "type": "processing",
            "category": "Processing",
            "properties": [
                {"name": "iterations", "type": "integer", "default": 1},
                {
                    "name": "border type",
                    "type": "select",
                    "values": ["constant", "replicate", "wrap", "reflect"],
                    "default": "constant"
                }
            ],
            "inputs": [
                {"name": "image", "type": "Image"},
                {"name": "kernel", "type": "Image"}
            ],
            "outputs": [{"name": "output", "type": "Image"}]
        },
        {
            "name": "Threshold",
            "type": "processing",
            "category": "Processing",
            "properties": [
                {"name": "threshold_value", "type": "integer", "default": 1},
                {
                    "name": "threshold_type",
                    "type": "select",
                    "values": ["Binary", "Truncate", "Otsu"],
                    "default": "constant"
                }
            ],
            "inputs": [{"name": "image", "type": "Image"}],
            "outputs": [{"name": "output", "type": "BinaryImage"}]
        },
        {
            "name": "Morphological operation",
            "type": "processing",
            "category": "Processing",
            "properties": [
                {"name": "iterations", "type": "integer", "default": 1},
                {
                    "name": "border type",
                    "type": "select",
                    "values": ["constant", "replicate", "wrap", "reflect"],
                    "default": "constant"
                },
                {
                    "name": "operation type",
                    "type": "select",
                    "values": ["dilation", "erosion", "closing", "opening"],
                    "default": "dilation"
                }
            ],
            "inputs": [
                {"name": "image", "type": "BinaryImage"},
                {"name": "kernel", "type": "BinaryImage"}
            ],
            "outputs": [{"name": "output", "type": "BinaryImage"}]
        }
    ],
    "metadata": {
        "interfaces": {
            "Image": "#00FF00",
            "BinaryImage": "#FF0000"
        }
    }
}
```

Thanks to the flexibility of the specification format, you can use any combination of properties, inputs, and outputs to create a custom node.
It is also readable and divided into distinct parts, so you can implement a process of automated specification generation into an external application.
See the [External App Communication](external-app-communication) section to find out more.

A sample node created from the specification above:

![Sample node created from specification](img/example_specification.png)
