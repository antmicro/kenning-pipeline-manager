# Dataflow format

A rendered graph with all its nodes, their properties, values, and connections is called a dataflow.
Its state can be serialized and saved as a JSON file.

## Format description

The root of the dataflow format consists of two main attributes.

* `graph` - object of type [Graph](#graph) that describes the main graph displayed to the user.
* `graphTemplates` - list of subgraph nodes available to the user.
  Subgraph nodes are used to group multiple nodes in a subgraph and visualize them as a single node.
* `metadata` - structure of type [Metadata](specification-format-metadata).
  It is used to override metadata settings from the [Specification format](specification-format).
  In general, values from dataflow's `metadata` override settings from specification.
  For simple types, such as strings or integers, values are changed.
  For arrays and dictionaries, the values are updated (values of existing keys are replaced with new ones, and the new values in arrays are appended to the existing entries).


### Graph

The graph format has following attributes:

* `id` - unique value that identifies the graph.
* `nodes` - array that specifies all nodes in the dataflow.
  Every element is of type [Node](#node).
* `connections` - array that specifies all connections in the dataflow.
  Every element is of type [Connection](#connection).
* `inputs` - used for multi-graph dataflows.
  Should be set to an empty list.
* `outputs` - used for multi-graph dataflows.
  Should be set to an empty list.
* `panning` - object of type [Panning](#panning) that defines the position of the top-left corner in the rendered editor.
* `scaling` - floating-point number that defines the zoom level in the editor.

#### Node

An object that describes a single node in the editor.
Each node has:

* `type` - node type, as defined in the specification.
* `id` - unique value assigned to the node.
* `name` - optional field defining a node's name rendered to the user. If set, `name (type)` will be displayed, otherwise just the `type` will be rendered.
* `properties` - list describing the node's parameterized values.
  Every element is of type [Property](#property)
* `interfaces` - list describing the node's interfaces.
  Every element is of type [Interface](#interface)
* `width` - the node's width in the editor.
* `twoColumn` - boolean value.
  If set to `true`, then input and output sockets are both rendered in the top part of the node and properties are displayed below.

##### Property

Each property is described by an object with three attributes:

* `id` - unique value assigned to the property
* `name` - name of the property
* `value` - actual value of the property.

Node having two parameters: `example_text` of value `example_value` and `example_number` of value `123` would have the following `options` value:

```json
[
    {
        "id": 1,
        "name": "example_text",
        "value": "example_value"
    },
    {
        "id": 2,
        "name": "example_number",
        "value": 123
    }
]
```

##### Interface

Each input, output and inout is described by an object with three attributes:

* `id` - unique value assigned to the property.
  It is used to describe connections in the dataflow.
* `name` - name of the interface
* `direction` - value determining the type of the interfaces.
  Can be either `input`, `output` or `inout`.
* `connectionSide` - tells on which side of the node the interface should be placed.


#### Connection

Object that describes a singular connection.
It has three attributes:

* `id` - unique value assigned to the connection
* `from` - the connection's output socket id
* `to` - the connection's input socket id.

#### Panning

This object describes the position of the top-left corner of the rendered editor in the browser.
Defines the camera position in the editor space.
Two attributes are used:

* `x` - x coordinate of the corner
* `y` - y coordinate of the corner.

## Example dataflow

The example dataflow for a specification defined in [Specification format](specification-format) is defined as below:

{ emphasize-lines="5-44,243-245,248-250,253-255" }
```json
{
    "graph": {
        "id": "2035108300",
        "nodes": [
            {
                "type": "Filter2D",
                "id": "node_168064109167511",
                "position": {
                    "x": 544,
                    "y": 77
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "name": "image",
                        "id": "ni_168064109167612",
                        "direction": "input"
                    },
                    {
                        "name": "kernel",
                        "id": "ni_168064109167613",
                        "direction": "input"
                    },
                    {
                        "name": "output",
                        "id": "ni_168064109167714",
                        "direction": "output"
                    }
                ],
                "properties": [
                    {
                        "name": "iterations",
                        "id": "8434027854",
                        "value": 1
                    },
                    {
                        "name": "border type",
                        "id": "7165552813",
                        "value": "constant"
                    }
                ],
                "name": "Filter"
            },
            {
                "type": "LoadVideo",
                "id": "node_168064220761015",
                "position": {
                    "x": -60,
                    "y": -36
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "name": "frames",
                        "id": "ni_168064220761016",
                        "direction": "output"
                    }
                ],
                "properties": [
                    {
                        "name": "filename",
                        "id": "8887517324",
                        "value": "input.mp4"
                    }
                ],
                "name": ""
            },
            {
                "type": "GaussianKernel",
                "id": "node_168064222522321",
                "position": {
                    "x": -65,
                    "y": 295
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "name": "kernel",
                        "id": "ni_168064222522422",
                        "direction": "output"
                    }
                ],
                "properties": [
                    {
                        "name": "size",
                        "id": "1247863780",
                        "value": 5
                    },
                    {
                        "name": "sigma",
                        "id": "0187870808",
                        "value": 1
                    }
                ],
                "name": ""
            },
            {
                "type": "Threshold",
                "id": "node_168064225320530",
                "position": {
                    "x": 999,
                    "y": 100
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "name": "image",
                        "id": "ni_168064225320531",
                        "direction": "input"
                    },
                    {
                        "name": "output",
                        "id": "ni_168064225320532",
                        "direction": "output"
                    }
                ],
                "properties": [
                    {
                        "name": "threshold_value",
                        "id": "8770324282",
                        "value": 1
                    },
                    {
                        "name": "threshold_type",
                        "id": "8305532648",
                        "value": "Otsu"
                    }
                ],
                "name": ""
            },
            {
                "type": "StructuringElement",
                "id": "node_168064227787336",
                "position": {
                    "x": 1010,
                    "y": 409
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "name": "kernel",
                        "id": "ni_168064227787437",
                        "direction": "output"
                    }
                ],
                "properties": [
                    {
                        "name": "size",
                        "id": "1587558664",
                        "value": 5
                    },
                    {
                        "name": "shape",
                        "id": "1375086555",
                        "value": "Cross"
                    }
                ],
                "name": "Structuring Element"
            },
            {
                "type": "Morphological operation",
                "id": "node_168064228786538",
                "position": {
                    "x": 1422,
                    "y": 54
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "name": "image",
                        "id": "ni_168064228786539",
                        "direction": "input"
                    },
                    {
                        "name": "kernel",
                        "id": "ni_168064228786540",
                        "direction": "input"
                    },
                    {
                        "name": "output",
                        "id": "ni_168064228786641",
                        "direction": "output"
                    }
                ],
                "properties": [
                    {
                        "name": "iterations",
                        "id": "0605526715",
                        "value": 1
                    },
                    {
                        "name": "border type",
                        "id": "2810748353",
                        "value": "constant"
                    },
                    {
                        "name": "operation type",
                        "id": "8413506138",
                        "value": "dilation"
                    }
                ],
                "name": ""
            },
            {
                "type": "SaveVideo",
                "id": "node_168064231007448",
                "position": {
                    "x": 1773,
                    "y": 76
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "name": "color",
                        "id": "ni_168064231007449",
                        "direction": "input"
                    },
                    {
                        "name": "binary",
                        "id": "ni_168064231007450",
                        "direction": "input"
                    }
                ],
                "properties": [
                    {
                        "name": "filename",
                        "id": "3087244218",
                        "value": "output.mp4"
                    }
                ],
                "name": "Save Video"
            }
        ],
        "connections": [
            {
                "id": "168064222082820",
                "from": "ni_168064220761016",
                "to": "ni_168064109167612"
            },
            {
                "id": "168064222926625",
                "from": "ni_168064222522422",
                "to": "ni_168064109167613"
            },
            {
                "id": "168064225938335",
                "from": "ni_168064109167714",
                "to": "ni_168064225320531"
            },
            {
                "id": "168064230015344",
                "from": "ni_168064225320532",
                "to": "ni_168064228786539"
            },
            {
                "id": "168064230253147",
                "from": "ni_168064227787437",
                "to": "ni_168064228786540"
            },
            {
                "id": "168064231874053",
                "from": "ni_168064228786641",
                "to": "ni_168064231007450"
            }
        ],
        "inputs": [],
        "outputs": [],
        "panning": {
            "x": 0,
            "y": 0
        },
        "scaling": 1
    },
    "graphTemplates": []
}
```

The highlighted bits of code represent all code fragments relevant to the `Filter2D` node.
In the `nodes` list, there is a full specification of the state of the `Filter2D` node:

* Its unique `id`
* Its `type`
* Its parameters (stored in `parameters`), e.g. `border_type` equal to `constant`
* Its interfaces, with unique `id` representing each input and output
* Rendering data, such as `position` or `width`.

Later, in `connections`, you can see triples representing to which interfaces the interfaces of `Filter2D` are connected.
