#!/bin/bash

echo "🚀 Starting Kuuzuki Desktop Development Environment"
echo "================================================="
echo ""

# Kill any existing processes on port 5174
echo "🧹 Cleaning up port 5174..."
node scripts/kill-port.js 5174

# Start Vite in background
echo "📦 Starting Vite dev server..."
npm run dev:vite &
VITE_PID=$!

# Wait for Vite to be ready
echo "⏳ Waiting for Vite to start..."
while ! curl -s http://localhost:5174 > /dev/null; do
  sleep 1
done

echo "✅ Vite is ready!"
echo ""

# Start Electron
echo "⚡ Starting Electron..."
echo "================================================="
echo ""

# Find electron binary
ELECTRON_BIN=""
if [ -f "../../node_modules/.bin/electron" ]; then
  ELECTRON_BIN="../../node_modules/.bin/electron"
elif [ -f "node_modules/.bin/electron" ]; then
  ELECTRON_BIN="node_modules/.bin/electron"
elif [ -f "/usr/bin/electron" ]; then
  ELECTRON_BIN="/usr/bin/electron"
else
  echo "❌ Electron binary not found!"
  kill $VITE_PID
  exit 1
fi

echo "📦 Using Electron: $ELECTRON_BIN"
echo ""

# Run Electron
ELECTRON_DISABLE_SANDBOX=1 $ELECTRON_BIN . --enable-logging

# When Electron exits, kill Vite
echo ""
echo "👋 Shutting down..."
kill $VITE_PID 2>/dev/null