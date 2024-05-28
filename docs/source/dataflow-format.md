# Dataflow format

A rendered graph with all its nodes, their properties, values, and connections is called a dataflow.
Its state can be serialized and saved as a JSON file.

## Format description

The root of the dataflow format consists of four main attributes.

* `graph` - object of type [Graph](#graph) that describes the main graph displayed to the user.
* `metadata` - structure of type [Metadata](specification-format-metadata).
  It is used to override metadata settings from the [Specification format](specification-format).
  In general, values from dataflow's `metadata` override settings from specification.
  For simple types, such as strings or integers, values are changed.
  For arrays and dictionaries, the values are updated (values of existing keys are replaced with new ones, and the new values in arrays are appended to the existing entries).
* `subgraphs` - List of subgraphs represented by subgraph nodes.
  The format of subgraphs is specified in the [Subgraphs](#subgraphs) section.
* `version` - string that identifies the version of the specification and dataflow.
  It is used to check compatibility between provided dataflow and the current version of the implementation.

### Graph

The `graph` property can either reference an existing graph that is included in `subgraphs` list or describe a new graph.
To reference an existing graph, the `graph` property should contain only one property - `entryGraph` - that specifies the ID of the graph that should be rendered.
See [Subgraphs](#subgraphs) section for more details.

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
  It refers to one of the [Subgraphs](#subgraphs) entries from `subgraphs` with a matching `id`.
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

{ emphasize-lines="5-44,243-245,248-250,253-255" }
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

## Subgraphs

Subgraphs are a way to encapsulate a part of the dataflow into a separate entity.
They can be used to simplify the dataflow structure, group nodes, or create reusable components.
On the frontend level, subgraphs are rendered as distinct nodes, which can be interacted with in the same way as standard nodes, but can be entered and expanded to show the content of the subgraph.
On top of that, interfaces of such subgraphs nodes may be exposed and accessed outside the graph, allowing to create more complex, multi-layer graph structures.

The graphs defined in `subgraphs` follow a format similar to the main graph.
Specifically, properties such as `id`, `name`, `additionalData`, `connections`, `panning`, and `scaling` follow the same rules.
The only differences are changes within the `nodes` definition, of which entries are modified.
Specifically, all properties follow the same rules, except two:
* `nodes` entries may now have a `subgraph` field, which indicates that the node itself is a subgraph node.
  Value of this field should be a string representing the ID of one of the subgraphs defined in `subgraphs` list.
  Note that each subgraph node can be used only once.
* `interfaces` lists of subgraph nodes differs slightly from interfaces of standard nodes.
  Subgraph interfaces may expose interfaces of nodes that are part of the subgraph.
  To do that both the interface of the subgraph node and the interface of the node within the subgraph must have the same `id` field.
  Additionally, the interface of the node in the subgraph has to define `externalName` property, which will be used to render the interface name in the subgraph node.
  Note that values of `externalName` of the subgraph node have to be unique.

Additionally, a subgraph dataflow must define a `graph` property.
This value determines which graph is rendered to the user when the dataflow is loaded.

## Example dataflow with subgraphs

```json
{
    "graphs": [
        {
            "id": "569edd54-0f42-4c24-a809-1509febbe23a",
            "nodes": [
                {
                    "id": "1212de63-daad-4ace-bc4b-df562b3a6b0e",
                    "position": {
                        "x": 600,
                        "y": 500
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "externalName": "Subgraph Input 1",
                            "id": "9db11824-0058-4213-a719-27af7c18a71d",
                            "direction": "input",
                            "side": "left",
                            "sidePosition": 0
                        },
                        {
                            "name": "Inout",
                            "externalName": "Subgraph Inout 1",
                            "id": "9ee6f424-00b2-4d25-8288-e0a88a1c1402",
                            "direction": "inout",
                            "side": "right",
                            "sidePosition": 0
                        },
                        {
                            "name": "Output",
                            "externalName": "Subgraph Output 1",
                            "id": "82fcb5be-2733-45f0-85fe-0f69ee339d30",
                            "direction": "output",
                            "side": "right",
                            "sidePosition": 1
                        }
                    ],
                    "properties": [],
                    "enabledInterfaceGroups": [],
                    "name": "Test node #1",
                    "instanceName": "Foo"
                },
                {
                    "id": "ecc91a3e-70c6-4197-a8bb-6513f9426b83",
                    "position": {
                        "x": 1100,
                        "y": 270
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "externalName": "Subgraph Input 2",
                            "id": "d6874fec-ff47-4268-9bbe-fa99569b4b17",
                            "direction": "input",
                            "side": "left",
                            "sidePosition": 0
                        },
                        {
                            "name": "Inout",
                            "externalName": "Subgraph Inout 2",
                            "id": "0aef6d82-e34d-4b44-bbbc-dfab58697a75",
                            "direction": "inout",
                            "side": "right",
                            "sidePosition": 0
                        },
                        {
                            "name": "Output",
                            "externalName": "Subgraph Output 2",
                            "id": "6669273b-0a62-4535-b4e2-bd799b86532c",
                            "direction": "output",
                            "side": "right",
                            "sidePosition": 1
                        }
                    ],
                    "properties": [],
                    "enabledInterfaceGroups": [],
                    "name": "Test node #1"
                }
            ],
            "connections": [
                {
                    "id": "27e6834d-1558-4778-8d82-853d21718181",
                    "from": "82fcb5be-2733-45f0-85fe-0f69ee339d30",
                    "to": "d6874fec-ff47-4268-9bbe-fa99569b4b17"
                }
            ],
            "scaling": 1,
            "panning": {
                "x": 0,
                "y": 0
            }
        },
        {
            "id": "40a30253-a806-4c36-906b-cbfd670d66ed",
            "nodes": [
                {
                    "id": "22132bcb-05c0-4b30-b137-943bb418bdeb",
                    "position": {
                        "x": 600,
                        "y": 200
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "externalName": "Subgraph Input 1",
                            "id": "b7c7d2a1-7c35-446c-be75-7116d768675c",
                            "direction": "input",
                            "side": "left",
                            "sidePosition": 0
                        },
                        {
                            "name": "Inout",
                            "externalName": "Subgraph Inout 1",
                            "id": "99f445df-4b17-433e-bfaa-1a34db437027",
                            "direction": "inout",
                            "side": "right",
                            "sidePosition": 0
                        },
                        {
                            "name": "Output",
                            "externalName": "Subgraph Output 1",
                            "id": "8eed590b-8411-4ea2-8050-29ec2bb207e6",
                            "direction": "output",
                            "side": "right",
                            "sidePosition": 1
                        }
                    ],
                    "properties": [],
                    "enabledInterfaceGroups": [],
                    "name": "Test node #1"
                },
                {
                    "id": "129c6246-d874-48cd-a33c-2927961d42e8",
                    "position": {
                        "x": 1200,
                        "y": 400
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "externalName": "Subgraph Input 2",
                            "id": "f56e769b-aa4e-4cda-b6d5-da7c4e48e39f",
                            "direction": "input",
                            "side": "left",
                            "sidePosition": 0
                        },
                        {
                            "name": "Inout",
                            "externalName": "Subgraph Inout 2",
                            "id": "7afe4e9b-74a2-4dc4-8b2a-008fc2789f63",
                            "direction": "inout",
                            "side": "left",
                            "sidePosition": 1
                        },
                        {
                            "name": "Output",
                            "externalName": "Subgraph Output 2",
                            "id": "52b07fe6-c1af-4480-bf2e-d0608e2e777c",
                            "direction": "output",
                            "side": "right",
                            "sidePosition": 0
                        }
                    ],
                    "properties": [
                        {
                            "name": "Sample option",
                            "id": "9ed1e992-15f9-4c1b-825c-40fc0e31a79d",
                            "value": "Option 4"
                        }
                    ],
                    "enabledInterfaceGroups": [],
                    "name": "Test node #2"
                }
            ],
            "connections": [
                {
                    "id": "c15f2559-c23a-4864-98ee-95049a48ce66",
                    "from": "8eed590b-8411-4ea2-8050-29ec2bb207e6",
                    "to": "f56e769b-aa4e-4cda-b6d5-da7c4e48e39f"
                }
            ],
            "scaling": 1,
            "panning": {
                "x": 0,
                "y": 0
            }
        },
        {
            "id": "9c4d5349-9d3b-401f-86bb-021b7b3e5b81",
            "nodes": [
                {
                    "id": "79a96644-9ff1-47e4-8226-335614efd103",
                    "position": {
                        "x": 572,
                        "y": 139
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "id": "69cfb668-bdbe-42ba-8870-85ea699673c6",
                            "direction": "input",
                            "side": "left",
                            "sidePosition": 0
                        },
                        {
                            "name": "Inout",
                            "id": "e0c36ee6-e4a1-4c0a-baef-cc5bbf92a5df",
                            "direction": "inout",
                            "side": "right",
                            "sidePosition": 0
                        },
                        {
                            "name": "Output",
                            "id": "b5b158b5-f65a-4f89-8aea-e2e4e6250352",
                            "direction": "output",
                            "side": "right",
                            "sidePosition": 1
                        }
                    ],
                    "properties": [],
                    "enabledInterfaceGroups": [],
                    "name": "Test node #1",
                    "instanceName": "Test node #1"
                },
                {
                    "id": "b57ae965-dbe7-4da7-8b6e-e8d3c3e743ab",
                    "position": {
                        "x": 1050,
                        "y": 113
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "id": "750b94e7-9053-40f2-83e6-7493356a584e",
                            "direction": "input",
                            "side": "left",
                            "sidePosition": 0
                        },
                        {
                            "name": "Inout",
                            "id": "194c1bdc-8126-4bcf-bbe7-77cb9d722e7a",
                            "direction": "inout",
                            "side": "left",
                            "sidePosition": 1
                        },
                        {
                            "name": "Output",
                            "id": "dd60c5a5-a502-4b2b-8de2-49cc7e28397b",
                            "direction": "output",
                            "side": "right",
                            "sidePosition": 0
                        }
                    ],
                    "properties": [
                        {
                            "name": "Sample option",
                            "id": "cf4a260b-dced-4122-9b08-c8da86bc900d",
                            "value": "Option 2"
                        }
                    ],
                    "enabledInterfaceGroups": [],
                    "name": "Test node #2",
                    "instanceName": "Test node #2"
                },
                {
                    "id": "0bfba841-a1e8-429c-aa8a-d98338339960",
                    "position": {
                        "x": 129,
                        "y": 208
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Subgraph Input 1",
                            "id": "9db11824-0058-4213-a719-27af7c18a71d",
                            "direction": "input",
                            "side": "right",
                            "sidePosition": 2
                        },
                        {
                            "name": "Subgraph Inout 1",
                            "id": "9ee6f424-00b2-4d25-8288-e0a88a1c1402",
                            "direction": "inout",
                            "side": "right",
                            "sidePosition": 0
                        },
                        {
                            "name": "Subgraph Inout 2",
                            "id": "0aef6d82-e34d-4b44-bbbc-dfab58697a75",
                            "direction": "inout",
                            "side": "right",
                            "sidePosition": 1
                        },
                        {
                            "name": "Subgraph Output 2",
                            "id": "6669273b-0a62-4535-b4e2-bd799b86532c",
                            "direction": "output",
                            "side": "right",
                            "sidePosition": 3
                        }
                    ],
                    "subgraph": "569edd54-0f42-4c24-a809-1509febbe23a",
                    "name": "Test subgraph node #1",
                    "instanceName": "Test subgraph node #1"
                },
                {
                    "id": "174b1b6d-99db-46d3-bb38-9b36b9930870",
                    "position": {
                        "x": 1490,
                        "y": 246
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Subgraph Input 1",
                            "id": "b7c7d2a1-7c35-446c-be75-7116d768675c",
                            "direction": "input",
                            "side": "left",
                            "sidePosition": 0
                        },
                        {
                            "name": "Subgraph Inout 1",
                            "id": "99f445df-4b17-433e-bfaa-1a34db437027",
                            "direction": "inout",
                            "side": "right",
                            "sidePosition": 0
                        },
                        {
                            "name": "Subgraph Inout 2",
                            "id": "7afe4e9b-74a2-4dc4-8b2a-008fc2789f63",
                            "direction": "inout",
                            "side": "left",
                            "sidePosition": 1
                        },
                        {
                            "name": "Subgraph Output 2",
                            "id": "52b07fe6-c1af-4480-bf2e-d0608e2e777c",
                            "direction": "output",
                            "side": "right",
                            "sidePosition": 1
                        }
                    ],
                    "subgraph": "40a30253-a806-4c36-906b-cbfd670d66ed",
                    "name": "Test subgraph node #2",
                    "instanceName": "Test subgraph node #2"
                }
            ],
            "connections": [
                {
                    "id": "90e3a49c-b388-4832-bb68-d447379c55ab",
                    "from": "e0c36ee6-e4a1-4c0a-baef-cc5bbf92a5df",
                    "to": "750b94e7-9053-40f2-83e6-7493356a584e"
                },
                {
                    "id": "c3578b94-b7e0-4908-9940-09bcede1430a",
                    "from": "6669273b-0a62-4535-b4e2-bd799b86532c",
                    "to": "69cfb668-bdbe-42ba-8870-85ea699673c6"
                },
                {
                    "id": "c2b9f036-e2be-4c88-9692-48746c0bfb53",
                    "from": "dd60c5a5-a502-4b2b-8de2-49cc7e28397b",
                    "to": "b7c7d2a1-7c35-446c-be75-7116d768675c"
                }
            ],
            "scaling": 0.7929515418502202,
            "panning": {
                "x": 399,
                "y": 248
            }
        }
    ],
    "entryGraph": "9c4d5349-9d3b-401f-86bb-021b7b3e5b81",
    "version": "20230523.12"
}
```
