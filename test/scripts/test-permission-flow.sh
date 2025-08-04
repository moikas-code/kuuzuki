#!/bin/bash

# Test script for permission dialog flow
# This script helps verify the permission system works end-to-end

echo "🧪 Testing Permission Dialog Flow"
echo "================================="

# Check if builds are up to date
echo "📦 Checking builds..."
if [ ! -f "./packages/tui/tui" ]; then
    echo "❌ TUI binary not found. Building..."
    ./run.sh build tui
fi

if [ ! -f "./packages/kuuzuki/bin/kuuzuki" ]; then
    echo "❌ Server binary not found. Building..."
    ./run.sh build server
fi

echo "✅ Builds ready"

# Start server in background
echo "🚀 Starting server..."
./packages/kuuzuki/bin/kuuzuki serve --port 3000 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Check if server is running
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ Server failed to start"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo "✅ Server running on port 3000"

# Instructions for manual testing
echo ""
echo "🎯 Manual Testing Instructions:"
echo "1. In another terminal, run: ./packages/tui/tui"
echo "2. Try to use a tool that requires permission (e.g., file operations)"
echo "3. Check that permission dialog appears lower on screen (not at top)"
echo "4. Approve or deny the permission using 'a' or 'd' keys"
echo "5. Check server logs for permission response messages"
echo "6. Verify tool execution continues/stops appropriately"
echo ""
echo "📋 What to look for:"
echo "- Dialog positioned better (not too high)"
echo "- Server logs show: 'Permission response sent'"
echo "- Tool execution continues after approval"
echo "- Tool execution stops after denial"
echo ""
echo "Press Ctrl+C to stop the server when done testing"

# Keep server running until user stops
wait $SERVER_PID