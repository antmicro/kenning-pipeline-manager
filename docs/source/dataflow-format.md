# Dataflow format

Dataflow is the name of the graph that is rendered.
Its state can be serialized and saved as a JSON file.

## Format description

The dataflow format has four main attributes.

* `panning` - object of type [Panning](#panning) that defines the position of the top-left corner in the rendered editor.
* `scaling` - floating-point number that defines the zoom level in the editor.
* `nodes` - array that specifies all nodes in the dataflow.
  Every element is of type [Node](#node).
* `connections` - array that specifies all connections in the dataflow.
  Every element is of type [Connection](#connection).

### Panning

This object describes the position of the top-left corner of the rendered editor in the browser.
Defines the camera position in the editor space.
Two attributes are used:

* `x` - x coordinate of the corner.
* `y` - y coordinate of the corner.

### Node

An object that describes a single node in the editor.
Each node has ten attributes:

* `type` - type of the node.
* `id` - unique value assigned to the node.
* `name` - name of the node that is rendered to the user.
* `options` - list describing parametrized values of the node.

Every element is a list consisting of two elements.
First being the name of the parameter, and second being its value.
Node having two parameters: `example_text` of value `example_value` and `example_number` of value `123` would have the following `options` value:

```json
[
    ["example_test", "example_value"],
    ["example_number", 123]
]
```

* `interfaces` - list of inputs and outputs of the node.
  Every element is of type [Interface](#interface)
* `width` - width of the node in the editor.
* `twoColumn` - boolean value. 
  True if inputs should be rendered on top of the node, or false if those should be rendered on the bottom of the node.
* `customClasses` - not used for now.
  Should be set to an empty string.
* `state` - not used for now.
  Should be set to an empty dictionary.

#### Interface

Each input and output is described by an object with four attributes:

* `id` - unique value assigned to the socket.
  It is used to desrcribe connections in the dataflow
* `isInput` - boolean value.
  True if the socket represents an input of a node, false otherwise.
* `type` - value that is used during validation of the connections.
  Only sockets of the same types can be connected.
* `value` - not used for now.
  Should be set to null.

### Connection

Object that describes a singular connection.
It has three attributes:

* `id` - unique value assigned to the connection.
* `from` - id of the output socket of the connection.
* `to` - id of the input socket of the connection.

## Example dataflow

The example dataflow for a specification defined in [Specification format](specification-format) is defined below:

{ emphasize-lines="3-54,294-296,299-301,304-306" }
```json
{
    "nodes": [
        {
            "type": "Filter2D",
            "id": "node_168064109167511",
            "name": "Filter2D",
            "options": [
                [
                    "iterations",
                    1
                ],
                [
                    "border type",
                    "constant"
                ]
            ],
            "state": {},
            "interfaces": [
                [
                    "image",
                    {
                        "id": "ni_168064109167612",
                        "value": null,
                        "isInput": true,
                        "type": "Image"
                    }
                ],
                [
                    "kernel",
                    {
                        "id": "ni_168064109167613",
                        "value": null,
                        "isInput": true,
                        "type": "Image"
                    }
                ],
                [
                    "output",
                    {
                        "id": "ni_168064109167714",
                        "value": null,
                        "isInput": false,
                        "type": "Image"
                    }
                ]
            ],
            "position": {
                "x": 544,
                "y": 77
            },
            "width": 200,
            "twoColumn": false,
            "customClasses": ""
        },
        {
            "type": "LoadVideo",
            "id": "node_168064220761015",
            "name": "LoadVideo",
            "options": [
                [
                    "filename",
                    "input.mp4"
                ]
            ],
            "state": {},
            "interfaces": [
                [
                    "frames",
                    {
                        "id": "ni_168064220761016",
                        "value": null,
                        "isInput": false,
                        "type": "Image"
                    }
                ]
            ],
            "position": {
                "x": -60,
                "y": -36
            },
            "width": 200,
            "twoColumn": false,
            "customClasses": ""
        },
        {
            "type": "GaussianKernel",
            "id": "node_168064222522321",
            "name": "GaussianKernel",
            "options": [
                [
                    "size",
                    5
                ],
                [
                    "sigma",
                    1
                ]
            ],
            "state": {},
            "interfaces": [
                [
                    "kernel",
                    {
                        "id": "ni_168064222522422",
                        "value": null,
                        "isInput": false,
                        "type": "Image"
                    }
                ]
            ],
            "position": {
                "x": -65,
                "y": 295
            },
            "width": 200,
            "twoColumn": false,
            "customClasses": ""
        },
        {
            "type": "Threshold",
            "id": "node_168064225320530",
            "name": "Threshold",
            "options": [
                [
                    "threshold_value",
                    1
                ],
                [
                    "threshold_type",
                    "Otsu"
                ]
            ],
            "state": {},
            "interfaces": [
                [
                    "image",
                    {
                        "id": "ni_168064225320531",
                        "value": null,
                        "isInput": true,
                        "type": "Image"
                    }
                ],
                [
                    "output",
                    {
                        "id": "ni_168064225320532",
                        "value": null,
                        "isInput": false,
                        "type": "BinaryImage"
                    }
                ]
            ],
            "position": {
                "x": 999,
                "y": 100
            },
            "width": 200,
            "twoColumn": false,
            "customClasses": ""
        },
        {
            "type": "StructuringElement",
            "id": "node_168064227787336",
            "name": "StructuringElement",
            "options": [
                [
                    "size",
                    5
                ],
                [
                    "shape",
                    "Cross"
                ]
            ],
            "state": {},
            "interfaces": [
                [
                    "kernel",
                    {
                        "id": "ni_168064227787437",
                        "value": null,
                        "isInput": false,
                        "type": "BinaryImage"
                    }
                ]
            ],
            "position": {
                "x": 1010,
                "y": 409
            },
            "width": 200,
            "twoColumn": false,
            "customClasses": ""
        },
        {
            "type": "Morphological operation",
            "id": "node_168064228786538",
            "name": "Morphological operation",
            "options": [
                [
                    "iterations",
                    1
                ],
                [
                    "border type",
                    "constant"
                ],
                [
                    "operation type",
                    "dilation"
                ]
            ],
            "state": {},
            "interfaces": [
                [
                    "image",
                    {
                        "id": "ni_168064228786539",
                        "value": null,
                        "isInput": true,
                        "type": "BinaryImage"
                    }
                ],
                [
                    "kernel",
                    {
                        "id": "ni_168064228786540",
                        "value": null,
                        "isInput": true,
                        "type": "BinaryImage"
                    }
                ],
                [
                    "output",
                    {
                        "id": "ni_168064228786641",
                        "value": null,
                        "isInput": false,
                        "type": "BinaryImage"
                    }
                ]
            ],
            "position": {
                "x": 1422,
                "y": 54
            },
            "width": 200,
            "twoColumn": false,
            "customClasses": ""
        },
        {
            "type": "SaveVideo",
            "id": "node_168064231007448",
            "name": "SaveVideo",
            "options": [
                [
                    "filename",
                    "output.mp4"
                ]
            ],
            "state": {},
            "interfaces": [
                [
                    "color",
                    {
                        "id": "ni_168064231007449",
                        "value": null,
                        "isInput": true,
                        "type": "Image"
                    }
                ],
                [
                    "binary",
                    {
                        "id": "ni_168064231007450",
                        "value": null,
                        "isInput": true,
                        "type": "BinaryImage"
                    }
                ]
            ],
            "position": {
                "x": 1773,
                "y": 76
            },
            "width": 200,
            "twoColumn": false,
            "customClasses": ""
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
    "panning": {
        "x": 83.81456605363859,
        "y": 271.1382297011724
    },
    "scaling": 0.8808971653295204
}
```

The highlighted bits of code represent all code fragments relevant to the `Filter2D` node.
In `nodes` list there is a full specification of the state of the `Filter2D` node:

* It's unique `id`
* It's `type`
* It's parameters (stored in `options`), e.g. `border_type` equal to `constant`
* It's interfaces, with unique `id` representing each input and output
* Rendering data, such as `position` or `width`

Later, in `connections` there are triples representing to which interfaces the interfaces of `Filter2D` are connected.
