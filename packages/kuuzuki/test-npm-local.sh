#!/bin/bash
set -e

echo "🧪 Testing kuuzuki npm package locally..."

# Clean up any previous builds
echo "📦 Cleaning up previous builds..."
rm -rf dist/npm
rm -f kuuzuki-*.tgz

# Create package structure
echo "🏗️  Creating package structure..."
mkdir -p dist/npm/kuuzuki/{bin,src}

# Copy source files
echo "📋 Copying source files..."
cp -r src/* dist/npm/kuuzuki/src/
cp README.md dist/npm/kuuzuki/
cp package.json dist/npm/kuuzuki/

# Prepare for npm (remove macros)
echo "🔨 Preparing for npm..."
cd dist/npm/kuuzuki
bun run ../../../scripts/prepare-npm.ts
cd ../../..

# Copy the launcher
echo "🔧 Installing launcher..."
cp bin/kuuzuki.js dist/npm/kuuzuki/bin/kuuzuki
chmod +x dist/npm/kuuzuki/bin/kuuzuki

# Fix the package.json bin path
cd dist/npm/kuuzuki
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.bin = { kuuzuki: './bin/kuuzuki' };
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

# Create tarball
echo "📦 Creating tarball..."
npm pack
mv kuuzuki-*.tgz ../../..

cd ../../..

# Show what we created
echo "✅ Created package:"
ls -la kuuzuki-*.tgz

echo ""
echo "To test installation:"
echo "  npm uninstall -g kuuzuki"
echo "  npm install -g ./kuuzuki-*.tgz"
echo "  kuuzuki --version"
echo ""
echo "To test in development:"
echo "  ./bin/kuuzuki.js --version"