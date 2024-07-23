# Dataflow format

A rendered graph with all its nodes, their properties, values, and connections is called a dataflow.
Its state can be serialized and saved as a JSON file.

## Format description

The root of the dataflow format consists of four main attributes.

* `metadata` - structure of type [Metadata](specification-format-metadata).
  It is used to override metadata settings from the [Specification format](specification-format).
  In general, values from dataflow's `metadata` override settings from specification.
  For simple types, such as strings or integers, values are changed.
  For arrays and dictionaries, the values are updated (values of existing keys are replaced with new ones, and the new values in arrays are appended to the existing entries).
* `entryGraph` - string that specifies the ID of the graph from `graphs` list that should be rendered when the dataflow is loaded.
  If not specified, the first graph in the list is rendered.
* `graphs` - array of objects of type [Graph](#graph) that describe available graphs in the dataflow.
  Each graph is a separate entity that can be rendered in the editor.
  If `entryGraph` is not specified, the first graph in the list is rendered when the dataflow is loaded.
* `version` - string that identifies the version of the specification and dataflow.
  It is used to check compatibility between provided dataflow and the current version of the implementation.

### Graph

Graphs are a way to encapsulate a part of the dataflow into a separate entity.
They can be used to simplify the dataflow structure, group nodes, or create reusable components.
On the frontend level, graphs are rendered as distinct nodes, which can be interacted with in the same way as standard nodes, but can be entered and expanded to show the content of the subgraph.
On top of that, interfaces of such graph nodes may be exposed and accessed outside the graph, allowing to create more complex, multi-layer graph structures.

Each graph can be described with the following properties:

* `id` - unique value that identifies the graph.
* `name` - human-readable name of the graph.
* `additionalData` - any JSON-like data that provides additional information regarding the graph.
* `nodes` - array that specifies all nodes in the dataflow.
  Every element is of type [Node](#node).
* `connections` - array that specifies all connections in the dataflow.
  Every element is of type [Connection](#connection).
* `panning` - object of type [Panning](#panning) that defines the position of the top-left corner in the rendered editor.
* `scaling` - floating-point number that defines the zoom level in the editor.

#### Node

An object that describes a single node in the editor.
Each node has:

* `name` - node name, as defined in the specification.
* `id` - unique value assigned to the node.
* `instanceName` - optional field defining a node's title rendered to the user.
  If set, `instancename (name)` will be displayed, otherwise, just the `name` will be rendered.
* `properties` - list describing the node's parameterized values.
  Every element is of type [Property](#property).
* `interfaces` - list describing the node's interfaces.
  Every element is of type [Interface](#interface).
* `width` - the node's width in the editor.
* `twoColumn` - boolean value.
  If set to `true`, the interfaces on opposite sides will be arranged parallel to each otherl. Otherwise, each interface will be positioned on a separate line.
* `subgraph` - optional field defining the `id` of the subgraph that this node represents.
  It refers to one of the [Graphs](#graph) entries from `graphs` with a matching `id`.
* `enabledInterfaceGroups` - optional array describing enabled interface groups.
  Every element is of type [Enabled Interface Groups](#enabled-interface-groups).

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

Each input, output, and inout is described by an object with the following attributes:

* `id` - unique value assigned to the property.
  It is used to describe connections in the dataflow.
* `name` - name of the interface
* `direction` - value determining the type of the interfaces.
  Can be either `input`, `output`, or `inout`.
* `side` - tells on which side of the node the interface should be placed.
* `sidePosition` - specifies a row on which the interface is rendered.
  Values for interfaces of the same `side` value have to be unique.
* `externalName` - name of the interface displayed in the editor.
  For every interface in each node, it is possible to make it a graph interface.
  A graph interface has its own unique external name, which is visible when the graph is nested within another graph.
  It is used to create multi-layer graphs, with subgraphs that can be connected to others nodes/graphs.
  Both the interface of the graph node and the interface of the node within the graph have the same `id` and `direction` fields.
  Note that values of `externalName` within the graph have to be unique.

Example of graph interfaces:

{ emphasize-lines="4,17,23,30,43-44" }
```json
{
    "graphs": [
        {
            "id": "9c4d5349-9d3b-401f-86bb-021b7b3e5b81",
            "nodes": [
                {
                    "id": "0bfba841-a1e8-429c-aa8a-d98338339960",
                    "position": {
                        "x": 0,
                        "y": 0
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Exposed Name",
                            "id": "29cd9a27-2b49-4ae7-a164-a574c07fc684",
                            "direction": "input",
                            "side": "left",
                            "sidePosition": 0
                        }
                    ],
                    "subgraph": "569edd54-0f42-4c24-a809-1509febbe23a",
                    "name": "Test subgraph node #1"
                }
            ],
            "connections": []
        },
        {
            "id": "569edd54-0f42-4c24-a809-1509febbe23a",
            "nodes": [
                {
                    "id": "56910b7a-9fe9-4db1-9d19-71037711d718",
                    "position": {
                        "x": 871,
                        "y": 316
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Within Input",
                            "externalName": "Exposed Name",
                            "id": "29cd9a27-2b49-4ae7-a164-a574c07fc684",
                            "direction": "input",
                            "side": "left",
                            "sidePosition": 0
                        }
                    ],
                    "name": "Exposed interface node"
                }
            ],
            "connections": []
        }
    ],
    "entryGraph": "9c4d5349-9d3b-401f-86bb-021b7b3e5b81",
    "version": "20240723.13"
}
```

The example consists of two graphs.
The first graph of id `9c4d5349-9d3b-401f-86bb-021b7b3e5b81` consists of a single graph node with an interface of id `29cd9a27-2b49-4ae7-a164-a574c07fc684`.
The node represents a graph of id `569edd54-0f42-4c24-a809-1509febbe23a`, which is a graph with a single node with an interface of id `29cd9a27-2b49-4ae7-a164-a574c07fc684`.
The interface of the graph node is exposed as `Exposed name` thanks to which it can be accessed from the outside of the graph.
Because the interface is exposed, both of those interfaces have to have the same `id` and `direction` value.

Graph node:

![Graph node](img/exposed_graph.png)

Node within graph:

![Node within graph](img/exposed_node.png)

#### Connection

Object that describes a singular connection.
It has three attributes:

* `id` - unique value assigned to the connection
* `from` - the connection's output interface id
* `to` - the connection's input interface id.
* `anchors` - optional list of [Anchor](#anchor) objects.

##### Anchor

This object describes a single anchor that is used to render connections divided into subparts.
Every part of the connection is rendered between two adjacent anchors.
Two attributes are used:

* `x` - x coordinate of the anchor
* `y` - y coordinate of the anchor.

#### Panning

This object describes the position of the top-left corner of the rendered editor in the browser.
Defines the camera position in the editor space.
Two attributes are used:

* `x` - x coordinate of the corner
* `y` - y coordinate of the corner.

#### Enabled Interface Groups

Each enabled interface group is described by the following properties:

* `name` - name of the interface group
* `direction` - value determining the type of the interfaces.
  Can be either `input`, `output` or `inout`.

```{warning}
Make sure that enabled interface groups use disjoint interfaces.
```

## Example dataflow

The example dataflow for a specification defined in [Specification format](specification-format) is defined as below:

{ emphasize-lines="6-45,243-245,248-250,253-255" }
```json
{
    "graphs": [
        {
            "id": "2035108300",
            "nodes": [
                {
                    "name": "Filter2D",
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
                    "instanceName": "Filter"
                },
                {
                    "name": "LoadVideo",
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
                    ]
                },
                {
                    "name": "GaussianKernel",
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
                    ]
                },
                {
                    "name": "Threshold",
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
                    ]
                },
                {
                    "name": "StructuringElement",
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
                    ]
                },
                {
                    "name": "Morphological operation",
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
                    ]
                },
                {
                    "name": "SaveVideo",
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
                    ]
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
            ]
            "panning": {
                "x": 0,
                "y": 0
            },
            "scaling": 1
        },
    ]
}
```

The highlighted bits of code represent all code fragments relevant to the `Filter2D` node.
In the `nodes` list, there is a full specification of the state of the `Filter2D` node:

* Its unique `id`
* Its `name`
* Its parameters (stored in `parameters`), e.g. `border_type` equal to `constant`
* Its interfaces, with unique `id` representing each input and output
* Rendering data, such as `position` or `width`.

Later, in `connections`, you can see triples representing to which interfaces the interfaces of `Filter2D` are connected.
