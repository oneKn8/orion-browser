#!/usr/bin/env python3
"""YAML configuration parser with environment variable substitution"""

import os
import yaml
from pathlib import Path
from typing import Any, Dict
from .utils import log_info, log_error, log_warning


def env_var_constructor(loader, node):
    """Custom YAML constructor for !env tag

    Usage in YAML:
      chromium_src: !env CHROMIUM_SRC
      path: !env HOME

    Returns empty string if environment variable is not set.
    """
    value = loader.construct_scalar(node)
    env_value = os.environ.get(value)

    if env_value is None:
        log_warning(f"Environment variable not set: {value} (using empty string)")
        return ''

    return env_value


# Register the !env constructor with SafeLoader
yaml.add_constructor('!env', env_var_constructor, Loader=yaml.SafeLoader)


def load_config(config_path: Path) -> Dict[str, Any]:
    """Load and parse YAML config file with environment variable substitution

    Supports !env tag for environment variables:
      chromium_src: !env CHROMIUM_SRC
      build_dir: !env BUILD_DIR
    """

    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    log_info(f"Loading config from: {config_path}")

    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    return config


def validate_required_envs(required_envs: list) -> None:
    """Validate that all required environment variables are set
    
    Raises SystemExit if any are missing
    """
    missing = []
    for env_var in required_envs:
        if not os.environ.get(env_var):
            missing.append(env_var)
    
    if missing:
        log_error("Missing required environment variables:")
        for var in missing:
            log_error(f"  - {var}")
        log_error("\nSet these variables and try again")
        raise SystemExit(1)
