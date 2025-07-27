#!/bin/bash

echo "🔧 Rebuilding node-pty for Electron..."

# Get Electron version
ELECTRON_VERSION=$(../../node_modules/.bin/electron --version | sed 's/v//')
echo "📦 Electron version: $ELECTRON_VERSION"

# Rebuild node-pty
echo "🔨 Rebuilding native modules..."
../../node_modules/.bin/electron-rebuild -f -w node-pty -v $ELECTRON_VERSION

echo "✅ Rebuild complete!"