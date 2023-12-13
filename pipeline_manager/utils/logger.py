# Copyright (c) 2020-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Module providing logging functionality.
"""

import logging


def string_to_verbosity(level: str):
    """
    Maps verbosity string to corresponding logging enum.
    """
    levelconversion = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    return levelconversion[level]
