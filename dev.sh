#!/bin/bash

# Quick development runner for kuucode
# Usage: ./dev.sh [tui|server|watch]

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

case "$1" in
    "server")
        echo "Starting server on port ${2:-8080}..."
        bun run packages/kuuzuki/src/index.ts serve --port ${2:-8080}
        ;;
    "watch")
        echo "Starting TUI with hot reload..."
        bun --watch packages/kuuzuki/src/index.ts tui
        ;;
    "link")
        echo "Setting up global commands..."
        cd "$SCRIPT_DIR/packages/kuuzuki"
        bun link
        echo "✓ Linked! You can now use 'kuuzuki' globally"
        ;;
    "unlink")
        echo "Removing global commands..."
        cd "$SCRIPT_DIR/packages/kuuzuki"
        bun unlink
        echo "✓ Unlinked!"
        ;;
    "tui"|"")
        echo "Starting TUI..."
        bun run packages/kuuzuki/src/index.ts
        ;;
    *)
        echo "Usage: ./dev.sh [command]"
        echo ""
        echo "Commands:"
        echo "  tui          Run TUI mode (default)"
        echo "  server [port] Run server mode"
        echo "  watch        Run TUI with hot reload"
        echo "  link         Set up global 'kuuzuki' command"
        echo "  unlink       Remove global command"
        ;;
esac