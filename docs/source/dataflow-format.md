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
* `graphTemplateInstances` - List of subgraphs represented by subgraph nodes.
  The format of subgraphs is specified in [Subgraphs](#subgraphs) section.
* `version` - string that identifies the version of the specification and dataflow.
  It is used to check compatibility between provided dataflow and the current version of the implementation.

### Graph

The graph format has following attributes:

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
* `subgraph` - optional field defining the `id` of the subgraph that this node represents.
  It refers to one of the [Subgraphs](#subgraphs) entries from `graphTemplateInstances` with matching `id`.
* `enabledInterfaceGroups` - optional array describing enabled interface groups.
  Every element is of type [Enabled Interface Groups](#enabled-interface-groups)

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

Each input, output and inout is described by an object with following attributes:

* `id` - unique value assigned to the property.
  It is used to describe connections in the dataflow.
* `name` - name of the interface
* `direction` - value determining the type of the interfaces.
  Can be either `input`, `output` or `inout`.
* `side` - tells on which side of the node the interface should be placed.
* `nodePosition` - specifies row on which the interface is rendered.
  Values for interfaces of the same `side` value have to be unique.

#### Connection

Object that describes a singular connection.
It has three attributes:

* `id` - unique value assigned to the connection
* `from` - the connection's output socket id
* `to` - the connection's input socket id.
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
    "graphTemplateInstances": []
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

## Subgraphs

If a node contains a `subgraph` field, it is considered a subgraph node.
It represents a unique subgraph instance that can be accessed and modified from the frontend level.
The `subgraph` field should be a string representing an ID of exactly one of the instances that are defined in `graphTemplateInstances`.
Each template cannot have more than one subgraph node pointing to it.

The graphs defined in `graphTemplateInstances` follow format similar to the main graph.
Specifically, properties such as `id`, `connections`, `panning`, and `scaling` follow the same rules.
The only differences are changes within the `nodes` definition and the addition of `interfaces` field.

Each subgraph can have `input`, `inout`, or `output` interfaces.
In the collapsed view, those are visible as regular interfaces of the node representing a subgraph.
In the subgraph view, each interface is represented by a dedicated node, called `Subgraph IO` node.
Such `Subgraph IO` node allows to configure such parameters as interface name or connection side.

Within the dataflow format, `interfaces` field allows to tie the subgraph node interface (subgraph IO)
with an interface in subgraph it is representing. `interfaces` is an array of object that follows the
format:

 * `id` - Unique ID of the interface within the subgraph
 * `nodePosition` - optional property (object containing `x` and `y` values) defining the
   position of the interface node after entering the subgraph.
   The default position is `(0, 0)`.

When defining the subgraph node (adding `subgraph` property to a node), the `interfaces` object
differs slightly from interfaces of standard nodes:

 * Every property like `id`, `direction`, or `side` follow the same rules.
 * `subgraphNodeId` must be set to `id` of `subgraphIO`.
 * New optional property `nodePosition` (object containing `x` and `y` values) defines the
 position of the `Subgraph IO` node after entering the subgraph. Default position is (0, 0)

## Example dataflow with subgraphs

```json
{
    "version": "20230720.5",
    "graph": {
        "id": "9c4d5349-9d3b-401f-86bb-021b7b3e5b81",
        "nodes": [
            {
                "type": "Test node #1",
                "id": "bfeb3891-53ce-476d-bc0b-a27e99428c10",
                "position": {
                    "x": 919,
                    "y": 241
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "name": "Input",
                        "id": "3c643e48-52f0-4dea-97e0-42c732cbe2e4",
                        "direction": "input",
                        "side": "left"
                    },
                    {
                        "name": "Inout",
                        "id": "bf735164-99fd-47e9-ba38-d26356eb5628",
                        "direction": "inout",
                        "side": "right"
                    },
                    {
                        "name": "Output",
                        "id": "a57c30cc-85d7-46e7-a48f-33d5aeb2c039",
                        "direction": "output",
                        "side": "right"
                    }
                ],
                "properties": [],
                "name": "Test node #1"
            },
            {
                "type": "Test node #2",
                "id": "ea3463d7-b4d5-4531-9ecb-e1f3d524f0aa",
                "position": {
                    "x": 1525,
                    "y": 182
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "name": "Input",
                        "id": "3937a772-dd2e-4037-950a-0ac150539bb9",
                        "direction": "input",
                        "side": "left"
                    },
                    {
                        "name": "Inout",
                        "id": "16946d84-2ede-44b0-b8b0-fd3664e7aedf",
                        "direction": "inout",
                        "side": "right"
                    },
                    {
                        "name": "Output",
                        "id": "4f1d2b5b-583c-4e5f-a925-94659482322d",
                        "direction": "output",
                        "side": "right"
                    }
                ],
                "properties": [
                    {
                        "name": "Sample option",
                        "id": "d536c9b8-bbb9-496d-81ab-d3946ff7cf79",
                        "value": "Option 2"
                    }
                ],
                "name": "Test node #2"
            },
            {
                "type": "Test subgraph node #1",
                "id": "4ece9e09-100e-45aa-9203-1c00241c2580",
                "title": "Test subgraph node #1",
                "position": {
                    "x": 520,
                    "y": 263
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "id": "4817aef3-f8e9-4771-9bed-1989357393e6",
                        "name": "Subgraph input",
                        "subgraphNodeId": "cd623eed-54a8-4d3b-b414-2b60869a23f3",
                        "direction": "input",
                        "side": "right"
                    },
                    {
                        "id": "e9cebd1e-995c-4fc0-be4e-5df6273ba01b",
                        "name": "Subgraph inout",
                        "subgraphNodeId": "50bfe451-ccb5-4a32-80a4-ea3b3202c54b",
                        "direction": "inout",
                        "side": "right"
                    },
                    {
                        "id": "a00f133c-3bd4-4c1e-89ac-903cfe868cbc",
                        "name": "Subgraph output",
                        "subgraphNodeId": "9a003337-3d15-4bbb-8e18-2d7bad8eb022",
                        "direction": "output",
                        "side": "right"
                    }
                ],
                "subgraph": "97abeeb5-61a1-4918-8816-5e74ba4e8be4"
            },
            {
                "type": "Test subgraph node #2",
                "id": "16ad1f85-41bf-4fbc-a8bb-0b8841a2a13d",
                "title": "Test subgraph node #2",
                "position": {
                    "x": 1963,
                    "y": 257
                },
                "width": 200,
                "twoColumn": false,
                "interfaces": [
                    {
                        "id": "e3176efa-fd16-4480-936f-3c85e0365be1",
                        "name": "Subgraph input",
                        "subgraphNodeId": "4f089550-4628-4924-ad7e-3cc4ce4b718c",
                        "direction": "input",
                        "side": "left"
                    },
                    {
                        "id": "481d1b0a-34fb-4d29-a288-f70658dc30ac",
                        "name": "Subgraph output",
                        "subgraphNodeId": "000f80bd-c6c9-4052-8c36-6659fa086c42",
                        "direction": "output",
                        "side": "right"
                    }
                ],
                "subgraph": "c84e5d7e-7713-4528-a5a7-9cad25209bb0"
            }
        ],
        "connections": [
            {
                "id": "7b0426b9-1ebb-45f4-8dc2-deb61cf5f03a",
                "from": "bf735164-99fd-47e9-ba38-d26356eb5628",
                "to": "3937a772-dd2e-4037-950a-0ac150539bb9"
            },
            {
                "id": "faad4eb8-f60c-498c-b931-f25e35d03ad2",
                "from": "a00f133c-3bd4-4c1e-89ac-903cfe868cbc",
                "to": "3c643e48-52f0-4dea-97e0-42c732cbe2e4"
            },
            {
                "id": "3a9b1e43-7060-40cf-b511-5f664edc478f",
                "from": "16946d84-2ede-44b0-b8b0-fd3664e7aedf",
                "to": "e3176efa-fd16-4480-936f-3c85e0365be1"
            }
        ]
    },
    "graphTemplateInstances": [
        {
            "id": "97abeeb5-61a1-4918-8816-5e74ba4e8be4",
            "nodes": [
                {
                    "type": "Test node #1",
                    "id": "72aa86ac-bcfd-48ba-ab0b-7c05c039ea48",
                    "position": {
                        "x": 749.2777990232428,
                        "y": 393.21003383663793
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "id": "a1f8ecf9-3ba5-49e0-b971-e4b522d39b41",
                            "direction": "input",
                            "side": "left"
                        },
                        {
                            "name": "Inout",
                            "id": "2ba9f981-a5ca-490c-a03f-3055c15ed27e",
                            "direction": "inout",
                            "side": "right"
                        },
                        {
                            "name": "Output",
                            "id": "43bbaa63-f1c4-4ef6-b8b6-3f543fec36d1",
                            "direction": "output",
                            "side": "right"
                        }
                    ],
                    "properties": [],
                    "name": ""
                },
                {
                    "type": "Test node #1",
                    "id": "fcfc1ea4-7780-4dff-882c-38928640bcad",
                    "position": {
                        "x": 1557.7609886679443,
                        "y": 359.7501309413528
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "id": "eb61a53c-b40e-4cde-a37e-2640e2953439",
                            "direction": "input",
                            "side": "left"
                        },
                        {
                            "name": "Inout",
                            "id": "3c848a6b-f7b0-434b-a806-896ea46dc535",
                            "direction": "inout",
                            "side": "right"
                        },
                        {
                            "name": "Output",
                            "id": "43b80380-300f-4b51-a11d-cf9d2aa5bd4a",
                            "direction": "output",
                            "side": "right"
                        }
                    ],
                    "properties": [],
                    "name": ""
                },
                {
                    "type": "Test node #1",
                    "id": "47f9b554-26a8-4c36-933f-118d353c038a",
                    "position": {
                        "x": 1166.3103153193495,
                        "y": 380.3184283143865
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "id": "ddbe6411-1af7-455d-94de-6e543a0b944b",
                            "direction": "input",
                            "side": "left"
                        },
                        {
                            "name": "Inout",
                            "id": "a3670f41-fda9-4370-a98c-9e1031f837d6",
                            "direction": "inout",
                            "side": "right"
                        },
                        {
                            "name": "Output",
                            "id": "62bf28f9-54b1-445d-9884-31b53a3f5d84",
                            "direction": "output",
                            "side": "right"
                        }
                    ],
                    "properties": [],
                    "name": "Test node #1"
                }
            ],
            "connections": [
                {
                    "id": "dc670e91-5e69-4728-b102-85994ecdfcce",
                    "from": "43bbaa63-f1c4-4ef6-b8b6-3f543fec36d1",
                    "to": "ddbe6411-1af7-455d-94de-6e543a0b944b"
                },
                {
                    "id": "83ac1716-a405-4371-89f9-df3b5325244f",
                    "from": "62bf28f9-54b1-445d-9884-31b53a3f5d84",
                    "to": "eb61a53c-b40e-4cde-a37e-2640e2953439"
                },
                {
                    "id": "something1",
                    "from": "cd623eed-54a8-4d3b-b414-2b60869a23f3",
                    "to": "a1f8ecf9-3ba5-49e0-b971-e4b522d39b41"
                },
                {
                    "id": "something2",
                    "from": "a3670f41-fda9-4370-a98c-9e1031f837d6",
                    "to": "50bfe451-ccb5-4a32-80a4-ea3b3202c54b"
                },
                {
                    "id": "something3",
                    "from": "43b80380-300f-4b51-a11d-cf9d2aa5bd4a",
                    "to": "9a003337-3d15-4bbb-8e18-2d7bad8eb022"
                }
            ],
            "interfaces": [
                {
                    "id": "cd623eed-54a8-4d3b-b414-2b60869a23f3",
                    "nodePosition": {
                        "x": 143.61666029302717,
                        "y": 443.6937472467506
                    }
                },
                {
                    "id": "50bfe451-ccb5-4a32-80a4-ea3b3202c54b",
                    "nodePosition": {
                        "x": 1642.6972860474395,
                        "y": 707.2506631277816
                    }
                },
                {
                    "id": "9a003337-3d15-4bbb-8e18-2d7bad8eb022",
                    "nodePosition": {
                        "x": 2212.630660612085,
                        "y": 517.2535000797645
                    }
                }
            ]
        },
        {
            "id": "c84e5d7e-7713-4528-a5a7-9cad25209bb0",
            "nodes": [
                {
                    "type": "Test node #1",
                    "id": "9cc0788d-38a5-43e0-a480-ea4adf070978",
                    "position": {
                        "x": 884.4110055908411,
                        "y": 260.7355824462513
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "id": "5d7fc255-bf5e-44ab-9c08-d81806b809ca",
                            "direction": "input",
                            "side": "left"
                        },
                        {
                            "name": "Inout",
                            "id": "06144692-e66d-45d5-9142-70feff09abfb",
                            "direction": "inout",
                            "side": "right"
                        },
                        {
                            "name": "Output",
                            "id": "c1fea113-7a15-48f0-a72a-79fba7ef0387",
                            "direction": "output",
                            "side": "right"
                        }
                    ],
                    "properties": [],
                    "name": ""
                },
                {
                    "type": "Test node #2",
                    "id": "98571611-c27f-4a87-90a0-f1e44c69b45e",
                    "position": {
                        "x": 1380.9345561767602,
                        "y": 282.3586198974247
                    },
                    "width": 200,
                    "twoColumn": false,
                    "interfaces": [
                        {
                            "name": "Input",
                            "id": "e2ea6cd2-9a41-4f3b-a12b-3b1370526ae8",
                            "direction": "input",
                            "side": "left"
                        },
                        {
                            "name": "Inout",
                            "id": "3b889b0a-ab70-4308-9ea2-5cf38c52f431",
                            "direction": "inout",
                            "side": "right"
                        },
                        {
                            "name": "Output",
                            "id": "a18ee2f2-ded8-4a3b-9f6f-6016545d65ef",
                            "direction": "output",
                            "side": "right"
                        }
                    ],
                    "properties": [
                        {
                            "name": "Sample option",
                            "id": "89c71d25-7add-45f9-80c3-291a3fe169ed",
                            "value": "Option 1"
                        }
                    ],
                    "name": ""
                }
            ],
            "connections": [
                {
                    "id": "edea7e7e-0c56-48d9-bcf9-06b883252ae2",
                    "from": "c1fea113-7a15-48f0-a72a-79fba7ef0387",
                    "to": "e2ea6cd2-9a41-4f3b-a12b-3b1370526ae8"
                },
                {
                    "id": "f2f5b890-3c1a-11ee-be56-0242ac120002",
                    "from": "4f089550-4628-4924-ad7e-3cc4ce4b718c",
                    "to": "5d7fc255-bf5e-44ab-9c08-d81806b809ca"
                },
                {
                    "id": "something5",
                    "from": "a18ee2f2-ded8-4a3b-9f6f-6016545d65ef",
                    "to": "000f80bd-c6c9-4052-8c36-6659fa086c42"
                }
            ],
            "interfaces": [
                {
                    "id": "4f089550-4628-4924-ad7e-3cc4ce4b718c",
                    "nodePosition": {
                        "x": 292.46867580583586,
                        "y": 287.222600903489
                    }
                },
                {
                    "id": "000f80bd-c6c9-4052-8c36-6659fa086c42",
                    "nodePosition": {
                        "x": 1836.126215821391,
                        "y": 268.86133874527513
                    }
                }
            ]
        }
    ]
}
```
