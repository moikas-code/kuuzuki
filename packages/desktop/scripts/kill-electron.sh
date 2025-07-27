#!/bin/bash

echo "🛑 Killing all Electron processes..."

# Kill any electron processes
pkill -f electron || true
pkill -f Electron || true

# Kill any node processes running our app
pkill -f "kuuzuki-desktop" || true
pkill -f "vite" || true

# Kill processes on port 5174
lsof -ti:5174 | xargs kill -9 2>/dev/null || true

echo "✅ Cleanup complete!"