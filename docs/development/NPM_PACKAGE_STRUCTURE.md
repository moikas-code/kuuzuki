# NPM Package Structure Guide

This document explains how the kuuzuki npm package is structured for global installation (`npm i -g kuuzuki`).

## Package Structure

```
packages/kuuzuki/
├── bin/
│   └── kuuzuki.js          # JavaScript entry point for npm
├── binaries/               # Cross-platform TUI binaries
│   ├── kuuzuki-tui-macos
│   ├── kuuzuki-tui-macos-arm64
│   ├── kuuzuki-tui-linux
│   ├── kuuzuki-tui-linux-arm64
│   ├── kuuzuki-tui-windows
│   └── kuuzuki-tui-windows-arm64
├── scripts/
│   ├── prepublish.js       # Builds binaries for all platforms
│   └── postinstall.js      # Makes binaries executable
├── package.json            # NPM package configuration
└── README.md              # Original README (unchanged)
```

## Key Components

### 1. JavaScript Entry Point (`bin/kuuzuki.js`)

The npm package uses a JavaScript wrapper that:
- Detects the current platform and architecture
- Spawns the appropriate TUI binary
- Passes all arguments through to the binary
- Handles errors gracefully

### 2. Cross-Platform Binaries (`binaries/`)

Pre-compiled Go binaries for all major platforms:
- **macOS**: x64 and ARM64
- **Linux**: x64 and ARM64
- **Windows**: x64 and ARM64

### 3. Build Scripts

- **`scripts/prepublish.js`**: Builds binaries for all platforms during npm publish
- **`scripts/postinstall.js`**: Makes binaries executable after npm install
- **`scripts/build-npm.sh`**: Complete build script for local development

## Package Configuration

### `package.json` Key Fields

```json
{
  "bin": {
    "kuuzuki": "./bin/kuuzuki.js"
  },
  "scripts": {
    "prepublishOnly": "node scripts/prepublish.js",
    "postinstall": "node scripts/postinstall.js"
  },
  "files": [
    "bin",
    "binaries",
    "scripts",
    "README.md"
  ]
}
```

## Build Process

### 1. Development Build

```bash
# Build for all platforms
./scripts/build-npm.sh

# Or use the run script
./run.sh build tui
```

### 2. Publishing

```bash
# Build the package
./scripts/build-npm.sh

# Publish to npm
cd packages/kuuzuki
npm publish
```

### 3. Local Testing

```bash
# Test the package locally
cd packages/kuuzuki
node bin/kuuzuki.js --help

# Or install globally (requires sudo)
sudo npm install -g .
```

## Platform Detection

The JavaScript entry point automatically detects:

- **Platform**: `darwin`, `linux`, `win32`
- **Architecture**: `arm64`, `amd64`
- **Binary Selection**: Maps to appropriate pre-compiled binary

## Installation Flow

1. **User runs**: `npm install -g kuuzuki`
2. **npm downloads**: Package with all binaries
3. **postinstall script**: Makes binaries executable
4. **User runs**: `kuuzuki` command
5. **JavaScript wrapper**: Detects platform and spawns correct binary

## Troubleshooting

### Permission Issues

```bash
# Use sudo (not recommended)
sudo npm install -g kuuzuki

# Or configure npm to use different directory
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Binary Not Found

```bash
# Check binary exists
ls -la node_modules/kuuzuki/binaries/

# Make executable manually
chmod +x node_modules/kuuzuki/binaries/*
```

### Build Issues

```bash
# Clean and rebuild
rm -rf packages/kuuzuki/binaries
./scripts/build-npm.sh
```

## Git Workflow Integration

This structure allows for:
- **CI/CD**: Automated builds and publishing
- **Version Management**: Semantic versioning with npm
- **Cross-platform Distribution**: Single package for all platforms
- **Easy Installation**: `npm install -g kuuzuki`

The original README remains unchanged for the git repository, while this structure provides a complete npm package experience. 