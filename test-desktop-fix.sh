#!/bin/bash

echo "Testing desktop app fix for 404 error..."
echo ""
echo "This script will:"
echo "1. Start the Kuuzuki server on port 4096"
echo "2. Launch the desktop app which should connect to it"
echo ""
echo "First, let's check if the server is already running..."

# Check if server is already running
if curl -s http://localhost:4096/app > /dev/null 2>&1; then
    echo "✅ Server is already running on port 4096"
else
    echo "⚠️  Server not running. Please start it with:"
    echo "    cd packages/kuuzuki && npm run kuuzuki serve"
    echo ""
    echo "Then run the desktop app with:"
    echo "    cd packages/desktop && npm run tauri dev"
    exit 1
fi

echo ""
echo "Server is ready! Now you can:"
echo "1. Run the desktop app: cd packages/desktop && npm run tauri dev"
echo "2. The TUI should connect to http://localhost:4096 (not 8080)"
echo "3. Try sending a message - it should work without 404 errors!"