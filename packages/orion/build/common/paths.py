#!/usr/bin/env python3
"""
Package root detection for Orion build system

This module provides a single function to find the orion package root
directory, regardless of the current working directory.

IMPORTANT: This module must have NO local imports to avoid circular dependencies.
It is imported by both context.py and env.py at module load time.
"""

import re
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def get_package_root() -> Path:
    """Find orion package root by walking up looking for pyproject.toml.

    Walks up from this file's location looking for a pyproject.toml that
    contains the orion package definition.

    Returns:
        Path to the orion package root (e.g., packages/orion/)

    Raises:
        RuntimeError: If package root cannot be found
    """
    current = Path(__file__).resolve().parent

    while current != current.parent:
        pyproject = current / "pyproject.toml"
        if pyproject.exists():
            content = pyproject.read_text()
            # Match name = "orion" with flexible whitespace
            if re.search(r'^name\s*=\s*["\']orion["\']', content, re.MULTILINE):
                return current
        current = current.parent

    raise RuntimeError(
        "Could not find orion package root. "
        "Expected to find pyproject.toml with name = 'orion' "
        f"in ancestors of {Path(__file__).resolve()}"
    )
