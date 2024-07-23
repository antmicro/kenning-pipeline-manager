# Dataflow and Specification format changelog

Formats of dataflows and specification is often updated with new features, that makes former formats incompatible with the new ones.
This section lists all versions, related features and breaking changes.

## 20240723.13

```{warning}
This update changes the existing format of specification and dataflow.
```

Commit SHA - TODO

* Added `includeGraphs` field allowing to include graphs in the specification as subgraphs
* Added `include` field allowing to include partial specification to the specification
* Replaced `graph` field with `graphs` list
* The default graph now can be:

  * the first entry in the `graphs` list
  * the graph from `graphs`, where `id` of the graph is equal to `entryGraph`
* Replaced `subgraphs` in specification with `graphs` that have the exact same format as regular graphs
* Introduced `externalName` for graph nodes
* Fixed `list` type for properties - now they can be defined as lists in the graph, and display/modified as space-separated entries
* Improved Markdown-based rendering of description

## 20230523.12

```{warning}
This update changes the existing format of specification and dataflow.
```

Commit SHA - `006998910f871da00c49ef00625e5d8bccf3a9c3`

* Introduced changes in dataflow and specification formats:
  * Removed `interfaces` property from graphs, which were used to define interface nodes for subgraphs.
  * Instead of "interface nodes", a new property was added to regular interfaces of nodes, called `externalName`.
  * `externalName`, when not empty, indicates that the interface is an outer interface of the subgraph, which should be exposed with the name from this field.

## 20230830.11

```{warning}
This update changes the existing format of specification and dataflow.
```

Commit SHA - `0bee99e152a408650590bb6ea4210e96502b33ef`

* Introduced changes in dataflow and specification formats:
  * `type` -> `name` for dataflows for consistency with specification naming
  * `name` -> `instanceName` for dataflows to make it more explicit and avoid conflicts
  * `type` -> `layer` for nodes in specification.
    This property is now also optional.
  * `nodeTypes` -> `nodeLayers` in `layers` keywords in metadata
  * `checkbox` -> `bool` for property type
  * `graphTemplateInstances` -> `subgraphs` for dataflow and specification.
* Added converter from version `20230824.10` to `20230523.12`
* Added `abstract` parameter for node types to define abstract types.
* Added `isCategory` parameter that allows defining category nodes which serve both as a node and category.

## 20230824.10

Commit SHA - `6ce3bf106353bc58fb8e7217b9bc8aa7db9ebd20`

* Choosing an entry graph that is rendered to the user when loading a subgraph dataflow is now possible using the `entryGraph` property.

## 20230824.9

Commit SHA - `de31d01d9b6591993559e3b10851815f3320e545`

* Introduced `description` keyword for nodes that allows displaying Markdown-based description in a sidebar.

## 20230818.8

Commit SHA - `d4abcc80bce3e280120078a47d784eff92821a8a`

* Introduced `group` keyword for checkbox property which allows defining groups of properties that can be disabled.

## 20230817.7

Commit SHA - `5946db06d8f42a33934a07fba95634aa8a70c78e`

* Format of subgraph dataflows and specifications is redesigned.
  Details can be found in [Dataflow format](dataflow-format) and [Specification format](specification-format).
* Dataflow
  * `SubgraphIO` was renamed to `interfaces` and its properties were changed.
  *  Connections are now defined using `connections` property instead of `nodeInterfaceId` keyword.
* Specification
  * `id` property for nodes and connections in subgraphs is no longer required.
  *  Connections are now defined using `connections` property instead of `nodeInterface` keyword.

## 20230809.6

Commit SHA - `59b04f8bc9cd0ce1cb757dcc4027750e1275d935`

* Introduced `anchors` for connections, which is a list of coordinates that allows rendering custom connections shapes.

## 20230619.5

Commit SHA - `84fe865ca44b3a80b87a2be418eedc1d1c025ee4`

* Introduced `defaultInterfaceGroups` groups of interfaces that are enabled by default.
* Implemented more verbose error logging both for interfaces and interface groups.

## 20230619.4

Commit SHA - `bdc4b2fb998ed9d6318a676d4ac77f92c1603d39`

* Introduced `interfaceGroups` and `enabledInterfaceGroups` keywords that allow defining groups of interfaces.
* Introduced arrays of interfaces that can be easily created using `array` keyword.
* Simplified dataflows as interfaces that have no connections are no longer saved into output `.json` files.

## 20230619.3

Commit SHA - `84559ae8327d7aa214c388200c5b48d112021679`

* Introduced two new keywords to the specification's `metadata`:
  * `backgroundSize` - defines size of the background grid.
  It has strictly visual effects.
  * `movementStep` - minimal node movement step.
* Added `additionalData` for storing some node-related data, not relevant to {{project}}
* Changed `connectionSide` to `side` in dataflow and specification
* `type` of interface now can be either a single string or a list of strings.
* Introduced optional metadata keyword `layout` specifying algorithm used for automatic node position calculation.
* Introduced `randomizedOffset` keyword that adds a random offset to connections so that a layout from complex graphs can be created easier.
  This value propagates into dataflows.

## 20230615.2

Commit SHA - `711ea7224e30d342924319c3964f1cb076939a29`

* Introduced inheritance mechanism in specification - for each node type it is possible to specify `extends` list that provides information which are the base classes for a given type.

## 20230615.1

Commit SHA - `4e0cf99ccaa5bc3513804e8184b907ed0230985f`

* Introduced versioning for dataflow and specification format, starting with version `20230615.1`.
  Pipeline Manager saves the current version in a dataflow save so that when loading a dataflow an appropriate message is displayed.
* Implemented a dataflow format converter that can apply a range of patches so that an obsolete dataflow can be updated to the current format.
