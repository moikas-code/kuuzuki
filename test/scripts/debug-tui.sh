#!/bin/bash
# Debug script for TUI focus issues

echo "=== Kuuzuki TUI Debug Script ==="
echo ""

# Kill any existing processes
echo "Killing any existing kuuzuki processes..."
pkill -f kuuzuki 2>/dev/null
sleep 1

# Test 1: Direct TUI binary test
echo "Test 1: Running TUI binary directly with test server..."
cat > /tmp/test-server.js << 'EOF'
const server = Bun.serve({
  port: 12275,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }));
    }
    if (url.pathname === "/config") {
      return new Response(JSON.stringify({
        providers: { demo: { id: "demo", name: "Demo", models: [{ id: "demo", name: "Demo Model" }] } },
        defaultProvider: "demo",
        defaultModel: "demo"
      }));
    }
    return new Response("Not found", { status: 404 });
  }
});
console.log(`Test server running on http://localhost:${server.port}`);
EOF

# Start test server in background
bun /tmp/test-server.js &
SERVER_PID=$!
sleep 1

# Run TUI
echo "Starting TUI (press Ctrl+C to stop)..."
KUUZUKI_SERVER=http://localhost:12275 KUUZUKI_APP_INFO='{"name":"kuuzuki","version":"test"}' KUUZUKI_MODES='[{"id":"default","name":"Default"}]' timeout 5 ./packages/tui/kuuzuki-tui

# Cleanup
kill $SERVER_PID 2>/dev/null
rm -f /tmp/test-server.js

echo ""
echo "Test complete. If you couldn't type in the input field, the issue persists."
echo ""
echo "Next steps to try:"
echo "1. Reset your terminal: reset"
echo "2. Try a different terminal emulator"
echo "3. Check if any terminal settings are interfering"