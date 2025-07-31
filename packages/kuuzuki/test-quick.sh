#!/bin/bash
set -e

# Quick test script for rapid iteration
echo "🚀 Quick NPM Package Test"
echo "========================"

# Build only for current platform
echo "📦 Building packages..."
bun scripts/build-npm-packages.ts --current-platform --pack

# Get platform info
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$PLATFORM" in
  darwin) PLATFORM="darwin" ;;
  linux) PLATFORM="linux" ;;
esac
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac

# Test the binary directly
echo ""
echo "🧪 Testing binary directly..."
./dist/binaries/${PLATFORM}-${ARCH}/kuuzuki --version

# Create temp directory for npm test
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo ""
echo "📥 Installing packages..."
npm init -y >/dev/null 2>&1
npm install --no-save \
  "$OLDPWD/dist/npm/kuuzuki/kuuzuki-0.1.9.tgz" \
  "$OLDPWD/dist/npm/kuuzuki-${PLATFORM}-${ARCH}/kuuzuki-${PLATFORM}-${ARCH}-0.1.9.tgz" >/dev/null 2>&1

echo ""
echo "✅ Testing via npx..."
npx kuuzuki --version

# Cleanup
cd "$OLDPWD"
rm -rf "$TEMP_DIR"

echo ""
echo "🎉 Quick test complete!"
echo ""
echo "To test more thoroughly, run:"
echo "  ./test-npm-package.sh --global"