#!/usr/bin/env python3
"""Linux signing module for Orion"""

from typing import List
from ...common.module import CommandModule
from ...common.context import Context
from ...common.utils import log_info, log_warning


class LinuxSignModule(CommandModule):
    produces = []
    requires = []
    description = "Linux code signing (no-op)"

    def validate(self, ctx: Context) -> None:
        pass

    def execute(self, ctx: Context) -> None:
        log_info("Code signing is not required for Linux packages")
def sign_universal(contexts: List[Context]) -> bool:
    """Linux doesn't support universal binaries"""
    log_warning("Universal signing is not supported on Linux")
    return True


def check_signing_environment() -> bool:
    """Linux doesn't require signing environment"""
    return True
