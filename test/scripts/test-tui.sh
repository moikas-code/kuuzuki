#!/bin/bash
set -e

echo "Testing Kuuzuki TUI startup..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${RED}Error: Go is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Go is installed${NC}"
go version

# Check if TUI source exists
TUI_DIR="packages/tui/cmd/kuuzuki"
if [ ! -f "$TUI_DIR/main.go" ]; then
    echo -e "${RED}Error: TUI source not found at $TUI_DIR/main.go${NC}"
    exit 1
fi

echo -e "${GREEN}✓ TUI source found${NC}"

# Try to build the TUI
echo -e "${YELLOW}Building TUI...${NC}"
cd "$TUI_DIR"
if go build -o test-tui ./main.go; then
    echo -e "${GREEN}✓ TUI built successfully${NC}"
    rm -f test-tui
else
    echo -e "${RED}✗ Failed to build TUI${NC}"
    exit 1
fi

# Check if bun is running
echo -e "${YELLOW}Checking for running instances...${NC}"
if pgrep -f "kuuzuki" > /dev/null; then
    echo -e "${YELLOW}Warning: Kuuzuki processes are already running${NC}"
    echo "You may want to kill them with: pkill -f kuuzuki"
fi

echo -e "${GREEN}All checks passed!${NC}"
echo ""
echo "To test the TUI in development mode, run:"
echo "  bun run dev:tui"
echo ""
echo "If the terminal locks up, try:"
echo "  1. Press Ctrl+C multiple times"
echo "  2. From another terminal: pkill -f kuuzuki"
echo "  3. Reset terminal: reset"