#!/usr/bin/env python3
"""
Base module system for Orion build pipeline

This module defines the base class for all build modules and the validation framework.
All build modules should inherit from BuildModule and implement validate() and execute().
"""

from typing import List


class ValidationError(Exception):
    """
    Raised when module validation fails

    This exception is raised by the validate() method when a module cannot execute
    due to missing requirements, platform incompatibility, or invalid configuration.
    The build pipeline stops immediately when ValidationError is raised.
    """
    pass


class CommandModule:
    """
    Base class for all build modules

    Each module represents a discrete step in the build pipeline (e.g., clean, compile, sign).
    Modules are self-contained and declare their requirements and outputs explicitly.

    Class Attributes:
        produces: List of artifact names this module creates (e.g., ["signed_app", "notarization_zip"])
        requires: List of artifact names this module needs (e.g., ["built_app"])
        description: Human-readable description for --list output

    Methods:
        validate(context): Check if module can run, raise ValidationError if not
        execute(context): Execute the module's main task

    Example:
        class CleanModule(BuildModule):
            produces = []
            requires = []
            description = "Clean build artifacts and reset git state"

            def validate(self, context):
                if not context.chromium_src.exists():
                    raise ValidationError(f"Chromium source not found: {context.chromium_src}")

            def execute(self, context):
                log_info("🧹 Cleaning build artifacts...")
                # ... cleaning logic ...
                log_success("Build artifacts cleaned")
    """

    # Metadata as class attributes (override in subclasses)
    produces: List[str] = []
    requires: List[str] = []
    description: str = "No description provided"

    def validate(self, context) -> None:
        """
        Validate that this module can run successfully

        This method should check all preconditions:
        - Platform requirements (e.g., macOS only)
        - Required artifacts from previous modules
        - Required environment variables
        - Required files/directories exist

        Args:
            context: BuildContext object with all build state

        Raises:
            ValidationError: If any precondition is not met

        Note:
            This method is called before execute(). The pipeline stops
            immediately if ValidationError is raised.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement validate()"
        )

    def execute(self, context) -> None:
        """
        Execute the module's main task

        This method performs the actual work of the module. It should:
        - Log its own progress using log_info(), log_success(), etc.
        - Register any artifacts it produces using context.artifacts.add()
        - Raise exceptions on failure (will stop the pipeline)

        Args:
            context: BuildContext object with all build state

        Raises:
            Exception: On any failure (stops the pipeline)

        Note:
            This method is only called after validate() succeeds.
            Modules should be idempotent where possible.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement execute()"
        )
