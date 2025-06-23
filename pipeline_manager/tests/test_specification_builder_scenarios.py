"""Module with test scenarios for specification builder."""


from contextlib import nullcontext

import pytest

from pipeline_manager.dataflow_builder.data_structures import Direction
from pipeline_manager.specification_builder import (
    SpecificationBuilder,
    SpecificationBuilderException,
)


@pytest.fixture
def specification_builder() -> SpecificationBuilder:
    """Pytest fixture providing an instance of specification builder."""
    VERSION = "20250623.14"
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


does_not_raise = nullcontext()
raises_spec_exception = pytest.raises(SpecificationBuilderException)


@pytest.mark.parametrize(
    "style_kwargs,metadata_icons,expectation",
    [
        ({"styleicon": "sample-icon"}, {}, does_not_raise),
        ({"styleicon": {"base": "suffix"}}, {}, raises_spec_exception),
        ({"styleicon": {"base": "suffix"}}, {"base": ""}, does_not_raise),
        ({"styleicon": 1}, {}, raises_spec_exception),
        ({"stylecolor": "#000000"}, {}, does_not_raise),
        (
            {"styleicon": "sample-icon", "stylecolor": "#000000"},
            {},
            does_not_raise,
        ),
    ],
)
def test_node_style(
    specification_builder, style_kwargs, metadata_icons, expectation
):
    """Verify whether node styling succeeds on sample scenarios."""
    spec = specification_builder
    name = "node"
    style = "style"

    with expectation:
        spec._metadata["icons"] = metadata_icons
        print(style_kwargs)
        spec.metadata_add_node_style(style, **style_kwargs)
        spec.add_node_type(name)
        spec.add_node_type_style(name, style)
        assert spec._nodes[name]["style"] == style
        spec.create_and_validate_spec(fail_on_warnings=True)


def test_node_style_absent(specification_builder):
    """
    Verify whether node styling fails if the provided node style does not exist
    in the metadata.
    """
    spec = specification_builder
    name = "node"
    style = "style"
    spec.add_node_type(name)

    with pytest.raises(SpecificationBuilderException):
        spec.add_node_type_style(name, style)


def test_node_style_exists_metadata(specification_builder):
    """
    Verify whether node styling fails if the same style is registered more than
    once.
    """
    spec = specification_builder
    style = "style"
    spec.metadata_add_node_style(style)

    with pytest.raises(SpecificationBuilderException):
        spec.metadata_add_node_style(style)


@pytest.mark.parametrize(
    "style1,style2,type1,type2",
    [
        ("style1", "style2", str, list),
        ("style1", ["style2"], str, list),
        (["style1"], "style2", list, list),
        (["style1"], ["style2"], list, list),
    ],
)
def test_node_multiple_styles(
    specification_builder, style1, style2, type1, type2
):
    """
    Verifies whether style types are consistent.
    """
    spec = specification_builder
    name = "node"
    spec.add_node_type(name)
    for style in ["style1", "style2"]:
        spec.metadata_add_node_style(style)

    spec.add_node_type_style(name, style1)
    assert isinstance(spec._nodes[name]["style"], type1)

    spec.add_node_type_style(name, style2)
    assert isinstance(spec._nodes[name]["style"], type2)

    spec.create_and_validate_spec(fail_on_warnings=True)


@pytest.mark.parametrize(
    "add_to_metadata,expectation",
    [
        (False, raises_spec_exception),
        (True, does_not_raise),
    ],
)
def test_include_with_style(
    specification_builder, add_to_metadata, expectation, httpserver
):
    """
    Verify whether styling of included nodes succeeds or fails depending on the
    fact whether the style was added to the metadata.
    """
    spec = specification_builder
    name = "node"
    style = "style"
    spec.add_node_type(name)
    include_specification = "/sample-specification.json"

    if add_to_metadata:
        spec.metadata_add_node_style(style)

    httpserver.expect_request(include_specification).respond_with_json({})
    with expectation:
        spec.add_include(httpserver.url_for(include_specification), style)

    spec.create_and_validate_spec(fail_on_warnings=True)
