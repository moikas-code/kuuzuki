#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${YELLOW}=== $1 ===${NC}\n"
}

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_DIR="$SCRIPT_DIR/../packages/kuuzuki"
TUI_DIR="$SCRIPT_DIR/../packages/tui"

print_header "Building NPM Package"

# Check dependencies
print_info "Checking dependencies..."
if ! command -v go &> /dev/null; then
    print_error "Go is required but not installed"
    exit 1
fi

if ! command -v bun &> /dev/null; then
    print_error "Bun is required but not installed"
    exit 1
fi

print_success "Dependencies OK"

# Clean previous builds
print_info "Cleaning previous builds..."
rm -rf "$PACKAGE_DIR/binaries"
rm -rf "$PACKAGE_DIR/bin/kuuzuki"
mkdir -p "$PACKAGE_DIR/binaries"

print_success "Clean complete"

# Build TUI binaries for all platforms
print_info "Building TUI binaries for all platforms..."

platforms=(
    "darwin:amd64:macos"
    "darwin:arm64:macos-arm64"
    "linux:amd64:linux"
    "linux:arm64:linux-arm64"
    "windows:amd64:windows"
    "windows:arm64:windows-arm64"
)

cd "$TUI_DIR"

for platform in "${platforms[@]}"; do
    IFS=':' read -r os arch suffix <<< "$platform"
    
    print_info "Building for $os/$arch..."
    
    # Set environment variables for cross-compilation
    export GOOS="$os"
    export GOARCH="$arch"
    export CGO_ENABLED=0
    
    # Build binary
    go build -o kuuzuki-tui ./cmd/kuuzuki
    
    # Copy to binaries with platform suffix
    binary_name="kuuzuki-tui-$suffix"
    cp kuuzuki-tui "$PACKAGE_DIR/binaries/$binary_name"
    
    # Clean up
    rm kuuzuki-tui
    
    print_success "Built $binary_name"
done

print_success "All TUI binaries built"

# Create the JavaScript entry point
print_info "Creating JavaScript entry point..."
cat > "$PACKAGE_DIR/bin/kuuzuki.js" << 'EOF'
#!/usr/bin/env node

import { spawn } from 'child_process';
import { platform, arch } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Determine the correct binary for the current platform
function getBinaryPath() {
  const p = platform();
  const a = arch();
  
  let platformName;
  switch (p) {
    case 'darwin':
      platformName = a === 'arm64' ? 'macos-arm64' : 'macos';
      break;
    case 'win32':
      platformName = a === 'arm64' ? 'windows-arm64' : 'windows';
      break;
    default:
      platformName = a === 'arm64' ? 'linux-arm64' : 'linux';
  }
  
  return join(__dirname, '..', 'binaries', `kuuzuki-tui-${platformName}`);
}

// Get the binary path
const binaryPath = getBinaryPath();

// Spawn the binary with all arguments passed through
const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    KUUZUKI_NPM_INSTALL: 'true'
  }
});

// Handle process exit
child.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle errors
child.on('error', (err) => {
  console.error('Failed to start kuuzuki:', err.message);
  console.error('Binary path:', binaryPath);
  console.error('Please ensure the binary exists and is executable.');
  process.exit(1);
});
EOF

chmod +x "$PACKAGE_DIR/bin/kuuzuki.js"
print_success "JavaScript entry point created"

# Make all binaries executable
print_info "Making binaries executable..."
chmod +x "$PACKAGE_DIR/binaries"/*
print_success "Binaries made executable"

# Test the package
print_info "Testing package..."
cd "$PACKAGE_DIR"
if npm pack --dry-run &> /dev/null; then
    print_success "Package structure is valid"
else
    print_error "Package structure is invalid"
    exit 1
fi

print_header "Build Complete"
print_success "NPM package is ready for publishing"
print_info "To publish: cd packages/kuuzuki && npm publish"
print_info "To test locally: npm install -g ." 