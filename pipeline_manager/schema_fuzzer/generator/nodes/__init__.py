# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that contains a library of classes that implement `BaseGenerator`. Each
of them represents one node in the generation tree. Each of them handles
different keyword, type, or syntax from the JSON Schema.
"""


from pipeline_manager.schema_fuzzer.generator.nodes.all_of import (
    AllOfGenerator,
)
from pipeline_manager.schema_fuzzer.generator.nodes.any_of import (
    AnyOfGenerator,
)
from pipeline_manager.schema_fuzzer.generator.nodes.const import ConstGenerator
from pipeline_manager.schema_fuzzer.generator.nodes.enum import EnumGenerator
from pipeline_manager.schema_fuzzer.generator.nodes.one_of import (
    OneOfGenerator,
)
from pipeline_manager.schema_fuzzer.generator.nodes.type_array import (
    ArrayGenerator,
)
from pipeline_manager.schema_fuzzer.generator.nodes.type_boolean import (
    BooleanGenerator,
)
from pipeline_manager.schema_fuzzer.generator.nodes.type_integer import (
    IntegerGenerator,
)
from pipeline_manager.schema_fuzzer.generator.nodes.type_null import (
    NullGenerator,
)
from pipeline_manager.schema_fuzzer.generator.nodes.type_number import (
    NumberGenerator,
)
from pipeline_manager.schema_fuzzer.generator.nodes.type_object import (
    ObjectGenerator,
)
from pipeline_manager.schema_fuzzer.generator.nodes.type_string import (
    StringGenerator,
)
from pipeline_manager.schema_fuzzer.generator.nodes.type_union import (
    UnionGenerator,
)

GENERATORS = [
    ConstGenerator,
    EnumGenerator,
    AnyOfGenerator,
    AllOfGenerator,
    OneOfGenerator,
    BooleanGenerator,
    IntegerGenerator,
    NumberGenerator,
    StringGenerator,
    ObjectGenerator,
    NullGenerator,
    UnionGenerator,
    ArrayGenerator,
]
