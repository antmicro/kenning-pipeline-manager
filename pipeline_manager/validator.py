from pathlib import Path
import subprocess
from typing import Optional

from pipeline_manager.frontend_builder import build_prepare


def validate(
        specification_path: Path,
        dataflow_path: Optional[Path] = None,
        install_dependencies: bool = False) -> int:
    """
    Validates specification, and optionally a graph associated with it.

    Parameters
    ----------
    specification_path: Path
        Path to the specification file
    dataflow_path: Path
        Path to the dataflow file
    install_dependencies: bool
        Tells whether npm dependencies should be installed during validation

    Returns
    -------
    int: Error code from the validator.js script, 0 if successful
    """
    projectpath = Path(__file__).parent.parent.absolute()
    frontend_path = projectpath / "pipeline_manager/frontend"

    if install_dependencies:
        build_prepare(frontend_path)

    if dataflow_path:
        exit_status = subprocess.run(
            [
                "node",
                "--no-warnings",
                "--loader",
                "ts-node/esm",
                "validator.js",
                specification_path.absolute(),
                dataflow_path.absolute(),
            ],
            cwd=frontend_path,
        )
    else:
        exit_status = subprocess.run(
            [
                "node",
                "--no-warnings",
                "--loader",
                "ts-node/esm",
                "validator.js",
                specification_path.absolute()
            ],
            cwd=frontend_path,
        )
    return exit_status.returncode
