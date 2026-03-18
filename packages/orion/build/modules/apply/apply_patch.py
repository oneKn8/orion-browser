"""
Apply Patch - Apply patch for a single chromium file.
"""

from typing import Tuple, Optional

from ...common.context import Context
from ...common.utils import log_info
from .common import apply_single_patch


def apply_single_file_patch(
    build_ctx: Context,
    chromium_path: str,
    reset_to: Optional[str] = None,
    dry_run: bool = False,
) -> Tuple[bool, Optional[str]]:
    """Apply patch for a single chromium file.

    Args:
        build_ctx: Build context
        chromium_path: Path to file in chromium (e.g., chrome/common/foo.h)
        reset_to: Commit to reset file to before applying
        dry_run: If True, only check if patch would apply

    Returns:
        Tuple of (success: bool, error_message: Optional[str])
    """
    patch_path = build_ctx.get_patch_path_for_file(chromium_path)

    if not patch_path.exists():
        return False, f"No patch found for: {chromium_path}"

    log_info(f"Applying patch for: {chromium_path}")
    if dry_run:
        log_info("DRY RUN - No changes will be made")

    return apply_single_patch(
        patch_path,
        build_ctx.chromium_src,
        dry_run=dry_run,
        relative_to=build_ctx.get_patches_dir(),
        reset_to=reset_to,
    )
