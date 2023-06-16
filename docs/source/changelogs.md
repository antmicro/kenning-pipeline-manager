# Dataflow and Specification format changelog

Formats of dataflows and specification is often updated with new features, that makes former formats incompatible with the new ones.
This section lists all versions, related features and breaking changes.

## 20230619.3

Commit SHA - `bd8b069bd923a6894cc57309dada45e9fe60c4a9`

* Introduced two new keywords to the specification's `metadata`:
  * `backgroundSize` - defines size of the background grid.
  It has stricly visual effects.
  * `movementStep` - minimal node movement step.
* Added `additionalData` for storing some node-related data, not relevant to {{project}}
* Changed `connectionSide` to `side` in dataflow and specification

## 20230615.2

Commit SHA - `711ea7224e30d342924319c3964f1cb076939a29`

* Introduced inheritance mechanism in specification - for each node type it is possible to specify `extends` list that provides information which are the base classes for a given type.

## 20230615.1

Commit SHA - `4e0cf99ccaa5bc3513804e8184b907ed0230985f`

* Introduced versioning for dataflow and specification format, starting with version `20230615.1`.
  Pipeline Manager saves current version in a dataflow save so that when loading a dataflow an appropriate message is displayed.
* Implemented a dataflow format converter, that can apply a range of patches so that an obsolete dataflow can be updateded to the current format.
