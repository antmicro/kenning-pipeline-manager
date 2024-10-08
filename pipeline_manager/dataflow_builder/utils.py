"""Module with dataflow builder's specific utility functions."""

import logging
import os
from pathlib import Path
from typing import Tuple, Union


def is_proper_input_file(
    file_path: Union[str, Path], intended_use: str = "specification"
) -> Tuple[bool, str]:
    """
    Determine if an input exists, is a regular file and contains
    any content.

    Parameters
    ----------
    file_path : Union[str, Path]
        Path to a file.
    intended_use : str, optional
        Single-word intended use of a file, by default "configuration".

    Returns
    -------
    Tuple[bool, str]
        Tuple of two values: 1) boolean - whether a file satisfies conditions
        of existence, being regular file, and having content, and 2) str -
        communicating a specific reason for failure.
    """
    intended_use = intended_use.title()

    file_path = file_path.absolute()
    if not file_path.exists():
        message = f"{intended_use} file not found under {str(file_path)}."
        logging.info(message)
        return (False, message)

    if not os.path.isfile():
        message = (
            f"{intended_use} path ({str(file_path)}) does not lead "
            "to a regular file."
        )
        logging.info(message)
        return (False, message)

    with open(file_path, mode="rt", encoding="utf-8") as fd:
        if not fd.read():
            message = f"{intended_use} file {str(file_path)} is empty."
            logging.info(message)
            return (False, message)

    return (True, "File is a proper input.")
