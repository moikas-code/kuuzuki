#!/bin/bash
# Final test for TUI focus fix

echo "=== Final TUI Focus Test ==="
echo ""
echo "This test will:"
echo "1. Kill any existing kuuzuki processes"
echo "2. Start the TUI in development mode"
echo "3. You should be able to type in the input field immediately"
echo ""
echo "Press Enter to continue..."
read

# Kill existing processes
pkill -f kuuzuki 2>/dev/null
sleep 1

echo "Starting TUI..."
echo "Try typing 'hello world' in the input field"
echo ""

bun run dev:tui