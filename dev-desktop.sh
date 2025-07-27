#!/bin/bash

# Simple script to run desktop in dev mode
echo "🚀 Starting Kuuzuki Desktop Development"
echo "======================================"

# Change to desktop directory
cd packages/desktop || exit 1

# Kill any existing processes on port 5174
echo "🧹 Cleaning up port 5174..."
npx kill-port 5174 2>/dev/null || true

# Make sure kuuzuki binary is available
echo "📦 Checking kuuzuki binary..."
if [ ! -f "assets/bin/kuuzuki" ]; then
    echo "⚠️  Kuuzuki binary not found, building..."
    cd ../opencode
    go build -o kuuzuki-cli .
    cd ../desktop
    mkdir -p assets/bin
    cp ../opencode/kuuzuki-cli assets/bin/kuuzuki
    chmod +x assets/bin/kuuzuki
fi

# Rebuild native modules if needed
echo "🔧 Checking native modules..."
if [ ! -d "node_modules/node-pty/build" ]; then
    echo "📦 Rebuilding native modules..."
    npm run rebuild:dev
fi

# Compile TypeScript files for main process
echo "📄 Compiling main process..."
npx tsc src/main/index.ts src/main/terminal-manager.ts src/main/plugin-loader.ts src/main/server-detector.ts src/preload/index.ts --outDir dist --module commonjs --target es2021 --esModuleInterop --skipLibCheck

# Start both Vite and Electron
echo ""
echo "🌐 Starting Vite on http://localhost:5174"
echo "⚡ Electron will launch when Vite is ready..."
echo ""

# Start Vite in background
npm run dev:vite &
VITE_PID=$!

# Wait for Vite to be ready
echo "⏳ Waiting for Vite server..."
while ! curl -s http://localhost:5174 >/dev/null 2>&1; do
    sleep 1
done

echo "✅ Vite is ready!"

# Start Electron
echo "⚡ Launching Electron..."
ELECTRON_DISABLE_SANDBOX=1 ../../node_modules/.bin/electron .

# When Electron exits, kill Vite
kill $VITE_PID 2>/dev/null