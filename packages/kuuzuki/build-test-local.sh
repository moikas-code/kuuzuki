#!/bin/bash
set -e

echo "🧪 Building and testing kuuzuki npm package locally..."

# Clean up
echo "🧹 Cleaning up..."
rm -rf dist-test
rm -f kuuzuki-*.tgz

# Create temp build directory
echo "📁 Creating build directory..."
mkdir -p dist-test

# Copy everything
echo "📋 Copying files..."
cp -r src dist-test/
cp -r bin dist-test/
cp -r scripts dist-test/
cp README.md dist-test/
cp package.json dist-test/

# Enter build directory
cd dist-test

# Run prepare-npm to fix macros
echo "🔨 Preparing for npm (removing macros)..."
bun run scripts/prepare-npm.ts

# Copy the launcher
echo "🔧 Installing launcher..."
cp ../bin/kuuzuki.js bin/kuuzuki
chmod +x bin/kuuzuki

# Update package.json bin path
echo "📝 Updating package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.bin = { kuuzuki: './bin/kuuzuki' };
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

# Pack it
echo "📦 Creating tarball..."
npm pack
mv kuuzuki-*.tgz ..

cd ..

echo "✅ Package built successfully!"
ls -la kuuzuki-*.tgz

echo ""
echo "📥 To install and test:"
echo "  bun install -g file:\$PWD/kuuzuki-0.1.9.tgz"
echo "  kuuzuki --version"
echo "  kuuzuki  # Test TUI"
echo ""
echo "🧪 To test without installing:"
echo "  cd dist-test && ./bin/kuuzuki --version"