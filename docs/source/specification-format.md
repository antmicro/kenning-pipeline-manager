# Specification format

{{project}} requires a JSON specification that defines the working environment.
It specifies all nodes, properties, available connections and any metadata for the editor.
It can be either passed by a file or fetched from an [external application](external-app-communication).

To be able to load any dataflow a specification defining nodes in this dataflow needs to be loaded in the frontend.
## Format description

The specification has to be a JSON file.
There are two main attributes.

* `metadata` - object of type [Metadata](#metadata) that specifies editor styling and metadata.
* `nodes` - array that specifies valid nodes.
  Every element is of type [Node](#node).

### Metadata

This object specifies additional editor options

Contains following optional properties:

* `interfaces`  - dictionary which defines styling of interfaces the nodes.
  Colors can be specified by a hexadecimal value or by name.
* `allowLoopbacks` - boolean value that determines whether connections with endpoints at the same node are allowed.
  Default value is `false`.
* `readonly` - boolean value determining whether the editor is in readonly mode.
  In readonly mode the user cannot create or remove nodes and connections.
  The nodes are locked and cannot be moved.
  Modification of any properties is disabled.
  The user is only allowed to load existing dataflows.
  Default value is `false`.
* `twoColumn` - boolean value determining layout of the nodes.
  If set to true then input and output sockets are rendered on top of the node and properties are rendered below.
  Default value is `false`.
* `connectionStyle` - string value that determines the style of connection.
  Can choose one out of the two options: `curved` or `orthogonal`.
  Default value is `curved`

An example:

```json
"metadata": {
    "interfaces": {
        "Dataset": "#FF0000"
    },
    "allowLoopbacks": false,
    "readonly": true,
    "connectionStyle": "orthogonal"
}
```

### Node

An object that specifies a single node.
Every input object has six required properties.

* `name` - name that is displayed in the editor.
* `type` - value that is used for styling.
* `category` - context menu category that is displayed in the editor.
* `inputs` - array with elements of type [Input](#input).
* `outputs` - array with elements of type [Output](#output).
* `properties` - array with elements of type [Property](#property).

Example node looks as follows:

```json
{
    "name": "Filter2D",
    "type": "filters",
    "category": "Filters",
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
    "inputs": [
        {
            "name": "image",
            "type": "Image"
        },
        {
            "name": "kernel",
            "type": "Image"
        }
    ],
    "outputs": [
        {
            "name": "output",
            "type": "Image"
        }
    ]
}
```

#### Input

An object that specifies a single input.
Every input object has two required properties.

* `name` - name of the input that is displayed in the editor.
* `type` - type of the input.
  It is used for styling and validation purposes.

```{note}
Only inputs and outputs of the same type can be connected.
```

#### Output

An object that specifies a single output.
Every output object has two required properties.

* `name` - name of the output that is displayed in the editor.
* `type` - type of the output.
  It is used for styling and validation purposes.

```{note}
Only inputs and outputs of the same type can be connected.
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
  A non modifiable text field displayed to the user.
* `number` - property is a float.
  A number field is displayed to the user.
* `integer` - property is an int.
  A number field that accepts only integers is displayed to the user.
* `select` - property is a string with a range defined.
  It requires a `values` property.
* `checkbox` - property is a bool.
  It requires a `default` property.
* `slider` - property is a float with a range specified.
  It requires `min` and `max` properties.
* `list` - property is a list of arguments of the same type, which can be specified using `dtype`.

Additional properties:

* `min` - specifies the left end of a range.
* `max` - specifies the right end of a range.
* `default` - specifies the default value that is selected.
  Its type depends on the `type` chosen.
* `values` - specifies a range of possible values for a `select` option.
* `dtype` - specifies data type of elements in a `list` option.
  Supported values are `string`, `number`, `integer`, `boolean`.
* `description` - description of the property.
  In some cases it is displayed to the user.

## Example

Let's check a sample specification containing some hypothetical definition of nodes for image processing.

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

Thanks to the flexibility of the specification format, any combination of properties, inputs and outputs can be used to create a custom node.
It is also readable and divided into disjoint parts so the process of automated specification generation can be implemented into an external application.
See [External App Communication](external-app-communication) section to find out more.

Example node created from above specification:

![Example node created from specification](img/example_specification.png)
