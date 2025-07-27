#!/bin/bash

echo "🧹 Cleaning up development processes..."

# Kill Vite on port 5174
if lsof -ti:5174 > /dev/null 2>&1; then
    echo "Killing processes on port 5174..."
    lsof -ti:5174 | xargs kill -9 2>/dev/null || true
fi

# Kill any running Electron processes
if pgrep -f "electron.*enable-logging" > /dev/null 2>&1; then
    echo "Killing Electron processes..."
    pkill -f "electron.*enable-logging" 2>/dev/null || true
fi

# Kill any running node processes with vite
if pgrep -f "node.*vite" > /dev/null 2>&1; then
    echo "Killing Vite processes..."
    pkill -f "node.*vite" 2>/dev/null || true
fi

# Kill any kuuzuki processes spawned by desktop app
if pgrep -f "kuuzuki.*tui" > /dev/null 2>&1; then
    echo "Killing Kuuzuki TUI processes..."
    pkill -f "kuuzuki.*tui" 2>/dev/null || true
fi

echo "✅ Cleanup complete!"