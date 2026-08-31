# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0
"""
Module that provides the main abstract class for all generators and the
generator context class.
"""

import logging
from abc import ABC, abstractmethod
from contextlib import contextmanager
from typing import Any, TypeAlias, TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)

Schema: TypeAlias = dict[str, Any]
Config: TypeAlias = dict[str, Any]

logger = logging.getLogger(__name__)


class BaseGenerator(ABC):
    """
    Abstract class for all generators.
    """

    def __init__(self, schema: Schema, context: "Context"):
        """
        Constructor method for the generator.

        Parameters
        ----------
        schema : Schema
            The parsed JSON Schema describing samples that the generator
            instance should produces.
        context : Context
            The generation context shared across the generator tree.

        """
        ...

    @abstractmethod
    def generate(self) -> Any:
        """
        Generates one random sample and returns it.

        Returns
        -------
        Any
            The generated random sample.
        """
        ...

    @classmethod
    @abstractmethod
    def is_associated(cls, schema: Schema) -> bool:
        """
        Checks if the generator can handle given schema and produce compliant
        samples.

        Parameters
        ----------
        schema : Schema
            The schema we inquire about.

        Returns
        -------
        bool
            True if the generator can handle provided schema.
        """
        ...

    @classmethod
    def get_config_class(cls) -> type[BaseModel] | None:
        return None


class Context:
    """
    The main context shared across the entire generation tree.

    This object is responsible for storing and distributing available generator
    classes and their respective configuration. When instantiating a new
    generator with `generator`, the object will receive (and most likely
    store) a reference to this object. If the provided schema comprises of
    subschemas, the generator will also recursively invoke `generator` to
    obtain generator objects for the subschemas.
    """

    @classmethod
    def load_generators(cls) -> list[type[BaseGenerator]]:
        from schema_fuzzer.generator.nodes import GENERATORS

        return GENERATORS

    def __init__(self, config: Config):
        """
        Constructor of the context class.

        Parameters
        ----------
        config : Config
            Configuration dictionary for the generator classes.

        """
        self.generator_classes = self.load_generators()
        self.config = config
        self.trace: list[str] = []

    def _generator(self, schema: Schema) -> BaseGenerator:
        """
        Obtain a generator instance capable of producing random samples
        compliant with the provided schema. Should be used by generators only,
        for enduser API use `generator()` method.

        Parameters
        ----------
        schema : Schema
            Parsed JSON Schema describing the expected samples.

        Returns
        -------
        BaseGenerator
            An instance of the BaseGenerator subclass capable of producing
            random samples.

        Raises
        ------
        ValueError
            It will raise ValueError if none of the defined generators declare
            support for the provided schema.

        """
        for generator_class in self.generator_classes:
            if generator_class.is_associated(schema):
                # If the generator class declares support for the given schema
                # we create an instance of it by providing it with the schema.
                # Please note that a reference to the context instance, i.e.
                # `self`, is also propagated down to the generator.
                return generator_class(schema, self)
        raise ValueError(f"No matching generator found for {schema}")

    def get_config(self, config_class: type[T]) -> T:
        """
        Obtain instance of a given config_class.

        This function is invoked by the generators to obtain their
        configuration from the context. Each generator can implement additional
        configuration class that inherits pydantic.BaseModel. Context object
        can be queried by with it later to obtain an instance of it.

        Parameters
        ----------
        config_class : type[T]
            A subclass of BaseModel describing configuration values for a given
            class.

        Returns
        -------
        T
            Instance of the provided class populated with the values from
            context configuration dictionary.

        """
        # First we obtain the class_name, which will be used as the toplevel
        # key to the configuration dictionary...
        key = config_class.__name__

        # ...then we query the configuration dictionary.
        values = self.config.get(key) or {}

        # Finally we instantiate the config_class with the obtained values.
        return config_class.model_validate(values)

    def generator(self, schema: Schema) -> BaseGenerator:
        """
        Create generator for a given schema.

        Parameters
        ----------
        schema : Schema
            Parsed JSON Schema

        Returns
        -------
        BaseGenerator
            An instance of `BaseGenerator` subclass capable of generating
            random samples compliant with the provided schema.

        Raises
        ------
        Exception
            Propagates all exceptions from the tree construction.

        """
        try:
            return self._generator(schema)
        except Exception:
            trace = " > ".join(self.trace)
            logger.error(f"Failed to construct generator tree. Trace: {trace}")
            raise

    @contextmanager
    def trace_child(self, *args: str):
        """
        Context manager responsible for generating stack traces in case tree
        construction fails.

        When a generator attempts to recursively obtain generator instance for
        its subschemas it should do so inside this context.

        """
        self.trace += args
        yield
        for _ in args:
            self.trace.pop()

    @classmethod
    def get_settings_schema(cls) -> Any:
        """
        Returns parsed JSON Schema for the configuration for the defined
        generator nodes.

        Returns
        -------
        Any
            Parsed JSON Schema
        """
        properties = {}
        generators = cls.load_generators()
        for generator in generators:
            config = generator.get_config_class()
            if config is None:
                continue
            properties[config.__name__] = config.model_json_schema()
        schema = {
            "$id": "settings.json",
            "description": "Settings schema generated from the defined generator nodes classes.",  #  noqa E501
            "properties": properties,
        }
        return schema

    @classmethod
    def get_default_settings(cls) -> Any:
        """
        Returns example settings object populated with default values.

        Returns
        -------
        Any
            An object with default settings.

        Raises
        ------
        ValidationError
            Raised if any of the defined configuration classes does not provide
            default values for all fields.programming font chooser
        """
        defaults = {}
        generators = cls.load_generators()
        for generator in generators:
            config = generator.get_config_class()
            if config is None:
                continue
            try:
                default = config.model_validate({})
            except ValidationError:
                logger.error(
                    f"{config.__name__} does not provide default values"
                )
                raise
            defaults[config.__name__] = default.model_dump()
        return defaults
