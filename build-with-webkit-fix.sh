#!/bin/bash
# Build script for Arch Linux with webkit2gtk-4.1 compatibility

set -e

echo "🔧 Building Kuuzuki with webkit2gtk-4.1 compatibility..."

# Create temporary directory for pkg-config files
export TEMP_PKG_CONFIG=$(mktemp -d)
trap "rm -rf $TEMP_PKG_CONFIG" EXIT

echo "📁 Creating temporary pkg-config directory: $TEMP_PKG_CONFIG"

# Copy all system pkg-config files
cp -r /usr/lib/pkgconfig/* "$TEMP_PKG_CONFIG/" 2>/dev/null || true
cp -r /usr/share/pkgconfig/* "$TEMP_PKG_CONFIG/" 2>/dev/null || true

# Create compatibility symlinks in temp directory
ln -sf "$TEMP_PKG_CONFIG/webkit2gtk-4.1.pc" "$TEMP_PKG_CONFIG/webkit2gtk-4.0.pc"
ln -sf "$TEMP_PKG_CONFIG/javascriptcoregtk-4.1.pc" "$TEMP_PKG_CONFIG/javascriptcoregtk-4.0.pc"

echo "✅ Created compatibility symlinks"

# Set PKG_CONFIG_PATH to use our temp directory first
export PKG_CONFIG_PATH="$TEMP_PKG_CONFIG:/usr/lib/pkgconfig:/usr/share/pkgconfig"

# Set webkit renderer fix if not already set
if [ -z "$WEBKIT_DISABLE_DMABUF_RENDERER" ]; then
    export WEBKIT_DISABLE_DMABUF_RENDERER=1
    echo "📌 Set WEBKIT_DISABLE_DMABUF_RENDERER=1"
else
    echo "📌 Using existing WEBKIT_DISABLE_DMABUF_RENDERER=$WEBKIT_DISABLE_DMABUF_RENDERER"
fi

echo "🚀 Starting build..."

# Pass any arguments to run.sh (default: build all)
if [ $# -eq 0 ]; then
    ./run.sh build all
else
    ./run.sh "$@"
fi

echo "✅ Build complete!"