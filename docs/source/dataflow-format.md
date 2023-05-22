# Dataflow format

A rendered graph with all its nodes, their properties, values, and connections is called a dataflow.
Its state can be serialized and saved as a JSON file.

## Format description

The root of the dataflow format consists of two main attributes.

* `graph` - object of type [Graph](#graph) that describes the main graph displayed to the user.
* `graphTemplates` - list of graph-nodes available to the user.

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
* `properties` - dictionary describing the node's parameterized values.
  Every element is of type [Property](#property)
* `inputs` - dictionary describing the node's inputs.
  Every element is of type [Interface](#interface)
* `outputs` - dictionary describing the node's outputs.
  Every element is of type [Interface](#interface)
* `width` - the node's width in the editor.
* `twoColumn` - boolean value.
  If set to `true`, then input and output sockets are both rendered in the top part of the node and properties are displayed below.

##### Property

Each property is described by an object with two attributes:

* `id` - unique value assigned to the property
* `value` - actual value of the property.

Node having two parameters: `example_text` of value `example_value` and `example_number` of value `123` would have the following `options` value:

```json
{
    "example_text": {
        "value": "example_value"
    },
    "example_number": {
        "value": 123
    }
}
```

##### Interface

Each input and output is described by an object with one attribute:

* `id` - unique value assigned to the property.
  It is used to describe connections in the dataflow.

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

{ emphasize-lines="6-39,215-217,220-222,225-227" }
```json
{
    "graphTemplates": [],
    "graph": {
        "id": "5347868844",
        "nodes": [
            {
                "type": "Filter2D",
                "id": "node_168064109167511",
                "name": "Filter",
                "position": {
                    "x": 544,
                    "y": 77
                },
                "inputs": {
                    "image": {
                        "id": "ni_168064109167612"
                    },
                    "kernel": {
                        "id": "ni_168064109167613"
                    }
                },
                "properties": {
                    "iterations": {
                        "id": "1868105035",
                        "value": 1
                    },
                    "border type": {
                        "id": "8101260841",
                        "value": "constant"
                    }
                },
                "outputs": {
                    "output": {
                        "id": "ni_168064109167714"
                    }
                },
                "width": 200,
                "twoColumn": false
            },
            {
                "type": "LoadVideo",
                "id": "node_168064220761015",
                "position": {
                    "x": -60,
                    "y": -36
                },
                "inputs": {},
                "properties": {
                    "filename": {
                        "id": "1638420580",
                        "value": "input.mp4"
                    }
                },
                "outputs": {
                    "frames": {
                        "id": "ni_168064220761016"
                    }
                },
                "width": 200,
                "twoColumn": false
            },
            {
                "type": "GaussianKernel",
                "id": "node_168064222522321",
                "position": {
                    "x": -65,
                    "y": 295
                },
                "inputs": {},
                "properties": {
                    "size": {
                        "id": "5411776763",
                        "value": 5
                    },
                    "sigma": {
                        "id": "5864187267",
                        "value": 1
                    }
                },
                "outputs": {
                    "kernel": {
                        "id": "ni_168064222522422"
                    }
                },
                "width": 200,
                "twoColumn": false
            },
            {
                "type": "Threshold",
                "id": "node_168064225320530",
                "position": {
                    "x": 999,
                    "y": 100
                },
                "inputs": {
                    "image": {
                        "id": "ni_168064225320531"
                    }
                },
                "properties": {
                    "threshold_value": {
                        "id": "0606318132",
                        "value": 1
                    },
                    "threshold_type": {
                        "id": "2005334003",
                        "value": "Otsu"
                    }
                },
                "outputs": {
                    "output": {
                        "id": "ni_168064225320532"
                    }
                },
                "width": 200,
                "twoColumn": false
            },
            {
                "type": "StructuringElement",
                "id": "node_168064227787336",
                "name": "Structuring Element",
                "position": {
                    "x": 1010,
                    "y": 409
                },
                "inputs": {},
                "properties": {
                    "size": {
                        "id": "8000013823",
                        "value": 5
                    },
                    "shape": {
                        "id": "6880788646",
                        "value": "Cross"
                    }
                },
                "outputs": {
                    "kernel": {
                        "id": "ni_168064227787437"
                    }
                },
                "width": 200,
                "twoColumn": false
            },
            {
                "type": "Morphological operation",
                "id": "node_168064228786538",
                "position": {
                    "x": 1422,
                    "y": 54
                },
                "inputs": {
                    "image": {
                        "id": "ni_168064228786539"
                    },
                    "kernel": {
                        "id": "ni_168064228786540"
                    }
                },
                "properties": {
                    "iterations": {
                        "id": "4338663076",
                        "value": 1
                    },
                    "border type": {
                        "id": "0111662888",
                        "value": "constant"
                    },
                    "operation type": {
                        "id": "5012783747",
                        "value": "dilation"
                    }
                },
                "outputs": {
                    "output": {
                        "id": "ni_168064228786641"
                    }
                },
                "width": 200,
                "twoColumn": false
            },
            {
                "type": "SaveVideo",
                "id": "node_168064231007448",
                "name": "Save Video",
                "position": {
                    "x": 1773,
                    "y": 76
                },
                "inputs": {
                    "color": {
                        "id": "ni_168064231007449"
                    },
                    "binary": {
                        "id": "ni_168064231007450"
                    }
                },
                "properties": {
                    "filename": {
                        "id": "8383848111",
                        "value": "output.mp4"
                    }
                },
                "outputs": {},
                "width": 200,
                "twoColumn": false
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
        "outputs": []
    }
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
