#!/bin/bash

echo "Testing hybrid context toggle command..."

# Build the project
echo "Building kuuzuki..."
./run.sh build all

# Test the toggle
echo -e "\nTesting /hybrid command in TUI:"
echo "1. Start kuuzuki with: ./run.sh dev tui"
echo "2. Type /hybrid and press Enter to toggle hybrid context"
echo "3. You should see a toast message showing the new state"
echo "4. The state will be saved and apply to new sessions"

echo -e "\nAlternatively, use the keybinding:"
echo "Press Ctrl+X (leader) then 'b' to toggle hybrid context"

echo -e "\nTo verify the state:"
echo "Check ~/.local/state/kuuzuki/tui file for hybrid_context_enabled value"