# 🚀 Kuuzuki Quick Start Guide

Welcome to Kuuzuki! This guide will get you up and running in minutes.

## 📋 Prerequisites

Make sure you have these installed:
- **Bun** - [Install](https://bun.sh/docs/installation)
- **Go** - [Install](https://golang.org/dl/) (for TUI)

## 🎯 Quick Start

We've created a beautiful script that handles everything. From the root directory:

```bash
# First time setup
./run.sh install    # Install all dependencies
./run.sh build all  # Build everything

# Run in development
./run.sh dev        # Start TUI (default)
./run.sh dev server # Start server
./run.sh dev desktop # Start desktop app
```

## 📚 All Commands

### Building
```bash
./run.sh build all     # Build everything
./run.sh build tui     # Build only TUI
./run.sh build server  # Build only server/CLI
./run.sh build desktop # Build only desktop app
```

### Development Mode
```bash
./run.sh dev           # Run TUI in development
./run.sh dev server    # Run server (default port: 4096)
./run.sh dev server 8080  # Run server on custom port
./run.sh dev desktop   # Run desktop app in development
```

### Production Mode
```bash
./run.sh prod          # Run production TUI
./run.sh prod server   # Run production server
./run.sh prod desktop  # Run production desktop app
```

### Other Commands
```bash
./run.sh check    # Check dependencies
./run.sh test     # Run tests
./run.sh clean    # Clean build artifacts
./run.sh help     # Show help
```

## 🎨 NPM Scripts

You can also use npm/bun scripts:

```bash
bun run build:all      # Build everything
bun run dev:desktop    # Run desktop in dev mode
bun run clean          # Clean artifacts
```

## 🏗️ Project Structure

```
kuucode/
├── run.sh              # Main build/run script
├── packages/
│   ├── kuuzuki/       # Core server/CLI code
│   ├── tui/           # Terminal UI (Go)
│   └── desktop/       # Desktop app (Tauri + React)
```

## 🔧 Configuration

The server stores its data in:
- Config: `~/.config/kuuzuki/`
- Data: `~/.local/share/kuuzuki/`
- State: `~/.local/state/kuuzuki/`
- Cache: `~/.cache/kuuzuki/`

## 🚦 Server Auto-Detection

The desktop app automatically detects running kuuzuki servers by:
1. Checking the last known port
2. Scanning common ports (4096, 3000, 8080, etc.)
3. Checking dynamic port ranges

Server info is stored in `~/.local/state/kuuzuki/server.json`

## 💡 Tips

- The `run.sh` script shows colored output for easy reading
- Use `./run.sh help` to see all available options
- The script checks dependencies before running
- Build artifacts are placed in standard locations

## 🐛 Troubleshooting

If you encounter issues:

1. Check dependencies: `./run.sh check`
2. Clean and rebuild: `./run.sh clean && ./run.sh build all`
3. Check logs: `~/.local/share/kuuzuki/log/`

Enjoy using Kuuzuki! 🎉