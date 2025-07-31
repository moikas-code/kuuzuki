# Testing Kuuzuki NPM Package Locally

This guide explains how to test the Kuuzuki npm package before pushing to GitHub.

## Quick Start

```bash
# Fastest test (builds and tests in temp directory)
./test-quick.sh

# Full test with global installation
./test-npm-package.sh --global

# Test in Docker (clean environment)
./test-docker.sh
```

## Available Test Scripts

### 1. `test-quick.sh` - Rapid Testing
The fastest way to test your changes:
- Builds packages for current platform only
- Tests in a temporary directory
- Automatically cleans up
- Takes ~30 seconds

```bash
./test-quick.sh
```

### 2. `test-npm-package.sh` - Comprehensive Testing
Full testing with multiple options:

```bash
# Test with local installation (default)
./test-npm-package.sh

# Test with global installation
./test-npm-package.sh --global

# Keep packages installed after test
./test-npm-package.sh --global --keep-installed

# Skip build step (use existing packages)
./test-npm-package.sh --skip-build
```

### 3. `test-docker.sh` - Clean Environment Testing
Tests in a Docker container to ensure no dependency on local environment:
- Tests in Node.js slim image
- Installs Bun runtime
- Verifies package works in clean system

```bash
./test-docker.sh
```

## Manual Testing Steps

### Build Packages
```bash
# Build for current platform only
bun scripts/build-npm-packages.ts --current-platform --pack

# Build for all platforms
bun scripts/build-npm-packages.ts --pack
```

### Test Binary Directly
```bash
# After building
./dist/binaries/linux-x64/kuuzuki --version
```

### Test with NPM Link
```bash
# Build packages
bun scripts/build-npm-packages.ts --current-platform

# Link packages
cd dist/npm/kuuzuki && npm link
cd ../kuuzuki-linux-x64 && npm link

# Test anywhere
kuuzuki --version

# Unlink when done
npm unlink -g kuuzuki kuuzuki-linux-x64
```

### Test with Global Install
```bash
# Install
npm i -g ./dist/npm/kuuzuki/*.tgz ./dist/npm/kuuzuki-linux-x64/*.tgz

# Test
kuuzuki --version
kuuzuki  # Test TUI

# Uninstall
npm uninstall -g kuuzuki kuuzuki-linux-x64
```

## What Gets Tested

All test scripts verify:
1. ✅ Package builds successfully
2. ✅ Binary has correct version
3. ✅ Launcher script finds platform binary
4. ✅ CLI responds to --version and --help
5. ✅ No runtime errors on startup

## Troubleshooting

### NPM Permission Errors (EACCES)
If you get npm permission errors when installing globally:

```
npm error code EACCES
npm error syscall mkdir
npm error path /usr/lib/node_modules/kuuzuki
```

**Quick Fix:**
```bash
# Run the setup script
./setup-npm-prefix.sh

# Then add to current session
export PATH=~/.npm-global/bin:$PATH

# Now install works without sudo
npm i -g ./dist/npm/kuuzuki/*.tgz ./dist/npm/kuuzuki-linux-x64/*.tgz
```

**Manual Fix:**
```bash
# Configure npm to use user directory
npm config set prefix ~/.npm-global
mkdir -p ~/.npm-global

# Add to ~/.bashrc or ~/.zshrc
export PATH=~/.npm-global/bin:$PATH

# Reload shell config
source ~/.bashrc  # or source ~/.zshrc
```

**Alternative: Using Bun**
```bash
# Bun link works without permission issues
cd dist/npm/kuuzuki && bun link
cd ../kuuzuki-linux-x64 && bun link

# Test
kuuzuki --version
```

### Platform Package Not Found
The launcher shows this error if the platform package isn't installed:
```
It seems that your package manager failed to install the right version of the kuuzuki CLI for your platform.
```

This is normal when testing - just install both packages:
```bash
npm i -g ./dist/npm/kuuzuki/*.tgz ./dist/npm/kuuzuki-$(uname -s)-$(uname -m)/*.tgz
```

### Bun Not Found
The production binaries don't require Bun, but the development version does:
```bash
curl -fsSL https://bun.sh/install | bash
```

## Pre-Push Checklist

Before pushing to GitHub:

- [ ] Run `./test-quick.sh` - passes?
- [ ] Run `./test-npm-package.sh --global` - passes?
- [ ] Version updated in `package.json`?
- [ ] Changelog updated?
- [ ] Git tag matches version?

## Publishing

After testing locally:

```bash
# Create and push tag
git tag kuuzuki-v0.1.10
git push origin kuuzuki-v0.1.10

# GitHub Actions will automatically:
# 1. Build binaries for all platforms
# 2. Create npm packages
# 3. Publish to npm registry
# 4. Create GitHub release
```