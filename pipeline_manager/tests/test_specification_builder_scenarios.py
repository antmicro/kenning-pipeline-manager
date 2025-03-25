"""Module with test scenarios for specification builder."""


import pytest

from pipeline_manager.dataflow_builder.data_structures import Direction
from pipeline_manager.specification_builder import SpecificationBuilder


@pytest.fixture
def specification_builder() -> SpecificationBuilder:
    """Pytest fixture providing an instance of specification builder."""
    VERSION = "20240723.13"
    return SpecificationBuilder(VERSION)


def test_adding_interface_group(specification_builder):
    """Test if adding an interface group succeeds."""
    NODE_NAME = "TestNode"
    LAYER_NAME = "TestNode"
    CATEGORY_NAME = "TestCategory"
    INTERFACE_NAME = "1"
    INTERFACE_TYPE = "test"
    spec: SpecificationBuilder = specification_builder

    spec.add_node_type(NODE_NAME, category=CATEGORY_NAME, layer=LAYER_NAME)
    spec.metadata_add_layer(LAYER_NAME, nodelayers=[NODE_NAME])
    spec.add_node_type_property(
        name=NODE_NAME,
        propname="test",
        proptype="text",
        default="testing",
    )
    spec.add_node_type_interface(
        name=NODE_NAME,
        interfacename=INTERFACE_NAME,
        interfacetype=INTERFACE_TYPE,
        array=[0, 32],
        direction=Direction.OUTPUT.value,
    )

    for i, indices in enumerate(((0, 30), (3, 30), (28, 30))):
        index = i + 1
        spec.add_node_interface_group(
            node_type_name=NODE_NAME,
            interface_group_name=f"{index}",
            interface_type=INTERFACE_TYPE,
            direction=Direction.INPUT if index == 1 else Direction.OUTPUT,
        )
        spec.add_interface_to_group_interface(
            node_type_name=NODE_NAME,
            interface_group_name=f"{index}",
            actual_interface_name=INTERFACE_NAME,
            direction=Direction.OUTPUT,
            index_or_indices=indices,
        )

        spec.create_and_validate_spec(
            fail_on_warnings=True,
        )


def test_enabling_interface_group_by_default(specification_builder):
    """
    Verify if enabling interface groups by adding it to default
    interface groups succeeds.
    """
    spec = specification_builder
    NODE = "node1"
    INTERFACE = "numerousInterfaces"
    INTERFACE_GROUP = "myGroup"
    CATEGORY = "SampleCategory"

    spec.add_node_type(NODE, CATEGORY)
    spec.add_node_type_interface(
        NODE,
        interfacename=INTERFACE,
        array=[0, 100],
        direction=Direction.OUTPUT.value,
    )
    spec.register_category(CATEGORY)
    spec.add_node_type_category(NODE, CATEGORY)
    spec.add_node_interface_group(
        node_type_name=NODE,
        interface_group_name=INTERFACE_GROUP,
        direction=Direction.OUTPUT,
    )
    spec.add_interface_to_group_interface(
        node_type_name=NODE,
        interface_group_name=INTERFACE_GROUP,
        actual_interface_name=INTERFACE,
        direction=Direction.OUTPUT,
        index_or_indices=(0, 50),
    )

    spec.enable_interface_group_by_default(
        node_name=NODE,
        interface_group=INTERFACE_GROUP,
        direction=Direction.OUTPUT,
    )

    spec.create_and_validate_spec(fail_on_warnings=True)
