#!/bin/bash

# Script to run the desktop app in production mode
echo "🚀 Starting Kuuzuki Desktop"
echo "=========================="

# Find the built app
APP_PATHS=(
    "packages/desktop/dist-electron/Kuuzuki Desktop-0.1.0.AppImage"
    "packages/desktop/dist-electron/linux-unpacked/kuuzuki-desktop"
    "packages/desktop/dist-electron/kuuzuki-desktop"
)

APP_FOUND=""
for path in "${APP_PATHS[@]}"; do
    if [ -f "$path" ]; then
        APP_FOUND="$path"
        break
    fi
done

if [ -z "$APP_FOUND" ]; then
    echo "❌ Desktop app not found!"
    echo ""
    echo "Please build the app first:"
    echo "  npm run build:desktop"
    echo ""
    echo "Or use ./run.sh build desktop"
    exit 1
fi

echo "📦 Running: $APP_FOUND"
echo ""

# Make it executable if needed
chmod +x "$APP_FOUND"

# Run the app
"$APP_FOUND"