#!/usr/bin/env python3
"""
Build Annotate - Creates git commits for each feature in features.yaml

This script processes the features.yaml file and creates individual git commits
for each feature, using the feature's files and description.
"""

import sys
import subprocess
import yaml
import click
from pathlib import Path

# Import shared utilities
from utils import log_info, log_error, log_success, log_warning


def load_features(features_file: Path) -> dict:
    """Load features from YAML file"""
    try:
        with open(features_file, 'r') as f:
            data = yaml.safe_load(f)
            return data.get('features', {})
    except Exception as e:
        log_error(f"Failed to load features file: {e}")
        return {}


def check_git_repo(chromium_src: Path) -> bool:
    """Check if directory is a git repository"""
    git_dir = chromium_src / '.git'
    return git_dir.exists()


def get_modified_files(chromium_src: Path, files: list[str]) -> list[str]:
    """Get list of files that have modifications or are untracked"""
    modified = []

    for file_path in files:
        full_path = chromium_src / file_path

        # Check if file exists
        if not full_path.exists():
            continue

        try:
            # Check git status for this file
            result = subprocess.run(
                ['git', 'status', '--porcelain', str(file_path)],
                cwd=chromium_src,
                capture_output=True,
                text=True,
                check=True
            )

            # If output exists, file has changes
            if result.stdout.strip():
                modified.append(file_path)

        except subprocess.CalledProcessError:
            # If git status fails, skip this file
            continue

    return modified


def git_add_and_commit(chromium_src: Path, files: list[str], commit_message: str) -> bool:
    """Add files and create commit"""

    # First, add all files
    try:
        for file_path in files:
            subprocess.run(
                ['git', 'add', str(file_path)],
                cwd=chromium_src,
                check=True,
                capture_output=True
            )
    except subprocess.CalledProcessError as e:
        log_error(f"Failed to add files: {e}")
        return False

    # Then commit
    try:
        subprocess.run(
            ['git', 'commit', '-m', commit_message],
            cwd=chromium_src,
            check=True,
            capture_output=True,
            text=True
        )
        return True
    except subprocess.CalledProcessError as e:
        # Check if it's because nothing was staged
        stderr = e.stderr or ''
        if 'nothing to commit' in stderr or 'nothing added to commit' in stderr:
            return False
        log_error(f"Failed to commit: {stderr}")
        return False


def process_features(chromium_src: Path, features_file: Path) -> int:
    """Process all features and create commits. Returns number of commits created."""

    features = load_features(features_file)
    if not features:
        log_error("No features found in features.yaml")
        return 0

    log_info(f"📋 Found {len(features)} features")
    log_info("=" * 60)

    commits_created = 0

    for feature_name, feature_data in features.items():
        description = feature_data.get('description', feature_name)
        files = feature_data.get('files', [])

        log_info(f"\n🔧 {feature_name}")
        log_info(f"   {description}")

        if not files:
            log_warning("   No files specified, skipping")
            continue

        # Find files with modifications
        modified_files = get_modified_files(chromium_src, files)

        if not modified_files:
            log_warning(f"   No modified files ({len(files)} files checked)")
            continue

        log_info(f"   Found {len(modified_files)} modified file(s)")

        # Create commit message
        commit_message = f"{feature_name}: {description}"

        # Add and commit
        if git_add_and_commit(chromium_src, modified_files, commit_message):
            log_success(f"   ✓ Committed {len(modified_files)} file(s)")
            commits_created += 1
        else:
            log_warning("   No changes staged, skipping commit")

    return commits_created


@click.command()
@click.option(
    '--chromium-src',
    '-S',
    type=click.Path(exists=True, path_type=Path),
    required=True,
    help='Path to Chromium source directory'
)
@click.option(
    '--features-file',
    '-f',
    type=click.Path(exists=True, path_type=Path),
    default=None,
    help='Path to features.yaml (defaults to build/features.yaml)'
)
def main(chromium_src, features_file):
    """
    Create git commits for each feature in features.yaml.

    For each feature, this script will:
    1. Check which files have modifications
    2. Stage those files with 'git add'
    3. Create a commit with the feature description

    Example:
        python build_annotate.py --chromium-src /path/to/chromium/src
    """

    log_info("🏗️  Build Annotate")
    log_info("=" * 60)

    # Validate git repository
    if not check_git_repo(chromium_src):
        log_error(f"Not a git repository: {chromium_src}")
        sys.exit(1)

    # Determine features file path
    if not features_file:
        root_dir = Path(__file__).parent.parent
        features_file = root_dir / 'build' / 'features.yaml'

    if not features_file.exists():
        log_error(f"Features file not found: {features_file}")
        sys.exit(1)

    log_info(f"📁 Chromium source: {chromium_src}")
    log_info(f"📄 Features file: {features_file}")

    try:
        commits_created = process_features(chromium_src, features_file)

        log_info("\n" + "=" * 60)
        if commits_created > 0:
            log_success(f"✓ Created {commits_created} commit(s)")
        else:
            log_info("No commits created (no modified files found)")
        log_info("=" * 60)

        sys.exit(0)

    except KeyboardInterrupt:
        log_warning("\nInterrupted by user")
        sys.exit(130)
    except Exception as e:
        log_error(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
