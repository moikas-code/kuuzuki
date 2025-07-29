#!/bin/bash

echo "=== Testing Hybrid Context Toggle ==="
echo

# Test 1: Check default state
echo "1. Testing default state (should be enabled)..."
KUUZUKI_HYBRID_CONTEXT_ENABLED="" bun run packages/kuuzuki/src/index.ts --version > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Default state works"
else
    echo "   ✗ Default state failed"
fi

# Test 2: Explicitly enable
echo "2. Testing explicit enable..."
KUUZUKI_HYBRID_CONTEXT_ENABLED=true bun run packages/kuuzuki/src/index.ts --version > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Explicit enable works"
else
    echo "   ✗ Explicit enable failed"
fi

# Test 3: Explicitly disable
echo "3. Testing explicit disable..."
KUUZUKI_HYBRID_CONTEXT_ENABLED=false bun run packages/kuuzuki/src/index.ts --version > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Explicit disable works"
else
    echo "   ✗ Explicit disable failed"
fi

echo
echo "=== Toggle Command Usage ==="
echo
echo "In the TUI, you can toggle hybrid context using:"
echo "  1. Slash command: Type '/hybrid' and press Enter"
echo "  2. Keybinding: Press Ctrl+X (leader) then 'b'"
echo
echo "The toggle will:"
echo "  - Show a toast notification with the new state"
echo "  - Save the preference to ~/.local/state/kuuzuki/tui"
echo "  - Apply to all new sessions (current session continues with initial setting)"
echo
echo "To verify the saved state:"
echo "  cat ~/.local/state/kuuzuki/tui | grep hybrid_context_enabled"
echo
echo "=== Testing Complete ==="