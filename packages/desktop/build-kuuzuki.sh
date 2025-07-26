#!/bin/bash
set -e

echo "Building Kuuzuki binary for desktop integration..."

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Ensure binaries directory exists
mkdir -p "$SCRIPT_DIR/src-tauri/binaries"

# Build kuuzuki binary
echo "Compiling kuuzuki with bun..."
cd "$ROOT_DIR/packages/opencode"

# Check if we can compile with bun
if command -v bun &> /dev/null; then
    bun build ./src/index.ts \
        --compile \
        --target=bun \
        --outfile="$SCRIPT_DIR/src-tauri/binaries/kuuzuki-x86_64-unknown-linux-gnu"

    # Make it executable
    chmod +x "$SCRIPT_DIR/src-tauri/binaries/kuuzuki-x86_64-unknown-linux-gnu"

    # Create a copy without the platform suffix for development
    cp "$SCRIPT_DIR/src-tauri/binaries/kuuzuki-x86_64-unknown-linux-gnu" \
       "$SCRIPT_DIR/src-tauri/binaries/kuuzuki"

    echo "✅ Kuuzuki binary built successfully!"
    echo "Location: $SCRIPT_DIR/src-tauri/binaries/kuuzuki-x86_64-unknown-linux-gnu"
else
    echo "❌ Error: bun is not installed"
    echo "Please install bun: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi