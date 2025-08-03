#!/bin/bash

# Quick development runner for kuuzuki
# Usage: ./dev.sh [tui|server|watch]

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

case "$1" in
    "server")
        echo "Starting server on port ${2:-8080}..."
        bun run packages/kuuzuki/src/index.ts serve --port ${2:-8080}
        ;;
    "watch")
        echo "Starting TUI development mode..."
        echo "This will run TUI once without auto-restart to avoid the reset issues."
        echo "When you make changes, manually restart with: bun dev"
        echo "----------------------------------------"
        
        # Just run once - much more stable for development
        bun packages/kuuzuki/src/index.ts tui
        ;;
    "autowatch")
        echo "Starting TUI with auto-restart (may be unstable)..."
        echo "File changes will restart the TUI. Use Ctrl+C to stop."
        echo "If this keeps resetting, use 'bun dev' instead."
        echo "----------------------------------------"
        
        # The original auto-watch for when you really need it
        bun --watch --watch-path="packages/kuuzuki/src" packages/kuuzuki/src/index.ts tui
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
        echo "  watch        Run TUI once (stable, manual restart)"
        echo "  autowatch    Run TUI with auto-restart (may be unstable)"
        echo "  link         Set up global 'kuuzuki' command"
        echo "  unlink       Remove global command"
        echo ""
        echo "Development tips:"
        echo "  - Use 'watch' for stable development (recommended)"
        echo "  - Use 'autowatch' only if you need auto-restart"
        echo "  - Use 'tui' for production-like testing"
        ;;
esac