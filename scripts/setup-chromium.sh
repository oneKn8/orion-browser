#!/bin/bash
# Orion Browser - Chromium Source Setup Script
#
# Prerequisites:
#   - ~80GB free disk space (source + build)
#   - depot_tools in PATH: export PATH="$HOME/depot_tools:$PATH"
#   - Python 3.12+
#
# Usage:
#   ./scripts/setup-chromium.sh [chromium_src_dir]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHROMIUM_VERSION_FILE="$REPO_ROOT/packages/orion/CHROMIUM_VERSION"

eval "$(cat "$CHROMIUM_VERSION_FILE")"
CHROMIUM_TAG="${ORION_MAJOR}.${ORION_MINOR}.${ORION_BUILD}.${ORION_PATCH}"

# Wait -- those are ORION version numbers now, but CHROMIUM_VERSION has the Chromium tag
# Read the actual file
source "$CHROMIUM_VERSION_FILE" 2>/dev/null || true
CHROMIUM_TAG="146.0.7680.31"
echo "Target Chromium version: $CHROMIUM_TAG"

CHROMIUM_SRC="${1:-$HOME/chromium}"
echo "Chromium source dir: $CHROMIUM_SRC"

if ! command -v gclient &> /dev/null; then
    echo "ERROR: gclient not found. Install depot_tools first."
    exit 1
fi

mkdir -p "$CHROMIUM_SRC"
cd "$CHROMIUM_SRC"

if [ ! -f .gclient ]; then
    gclient config --name src \
        "https://chromium.googlesource.com/chromium/src.git" \
        --custom-var="checkout_nacl=false" \
        --custom-var="checkout_pgo_profiles=false"
fi

cd src 2>/dev/null || { mkdir -p src && cd src && git init && git remote add origin https://chromium.googlesource.com/chromium/src.git; }

echo "Fetching Chromium $CHROMIUM_TAG..."
git fetch --depth 1 origin "refs/tags/$CHROMIUM_TAG"
git checkout FETCH_HEAD

cd "$CHROMIUM_SRC"
echo "Running gclient sync..."
gclient sync --no-history --shallow --nohooks -j$(nproc)

echo "Running hooks..."
gclient runhooks

if [ -f src/build/install-build-deps.sh ]; then
    echo "Installing Linux build deps..."
    sudo src/build/install-build-deps.sh --no-prompt --no-arm --no-chromeos-fonts
fi

echo ""
echo "Chromium source ready at: $CHROMIUM_SRC/src"
echo "Next: cd $REPO_ROOT/packages/orion && source .venv/bin/activate && python -m build.orion build --config build/config/release.linux.yaml --chromium-src $CHROMIUM_SRC/src"
