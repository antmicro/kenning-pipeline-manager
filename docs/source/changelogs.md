# Dataflow and Specification format changelog

Formats of dataflows and specification is often updated with new features, that makes former formats incompatible with the new ones.
This section lists all versions, related features and breaking changes.

## 20230615.1

Commit SHA - `4e0cf99ccaa5bc3513804e8184b907ed0230985f`

* Introduced versioning for dataflow and specification format, starting with version `20230615.1`.
  Pipeline Manager saves current version in a dataflow save so that when loading a dataflow an appropriate message is displayed.
* Implemented a dataflow format converter, that can apply a range of patches so that an obsolete dataflow can be updateded to the current format.