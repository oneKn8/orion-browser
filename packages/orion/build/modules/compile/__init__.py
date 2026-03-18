#!/usr/bin/env python3
"""
Compilation modules for Orion build system

This package contains different build strategies:
- standard: Single-architecture compilation
- universal: Multi-architecture compilation (macOS universal binaries)
"""

from .standard import CompileModule, build_target
from .universal import UniversalBuildModule

__all__ = [
    'CompileModule',
    'UniversalBuildModule',
    'build_target',
]
