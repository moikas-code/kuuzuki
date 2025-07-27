#!/bin/bash

# First compile the main process files
echo "📦 Compiling main process files..."
npx tsc src/main/index.ts src/main/terminal-manager.ts src/main/plugin-loader.ts src/main/server-detector.ts src/preload/index.ts --outDir dist --module commonjs --target es2021 --esModuleInterop --skipLibCheck

if [ $? -ne 0 ]; then
  echo "❌ TypeScript compilation failed"
  exit 1
fi

echo "✅ Main process compiled"

# Now run Electron
echo "⚡ Starting Electron..."
ELECTRON_DISABLE_SANDBOX=1 ../../node_modules/.bin/electron .