# Kuuzuki - AI Coding Agent

A fork of OpenCode with enhanced features including desktop support and automatic server detection.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/moikas-code/kuucode.git
cd kuucode

# Install dependencies
bun install

# Build everything
./run.sh build all

# Run desktop app (default)
./packages/opencode/kuuzuki-cli

# Run in terminal mode
./packages/opencode/kuuzuki-cli tui

# Start headless server
./packages/opencode/kuuzuki-cli serve
```

## 📁 Project Structure

```
kuucode/
├── packages/
│   ├── opencode/      # Main CLI and server
│   ├── desktop/       # Tauri desktop application
│   ├── tui/          # Terminal UI (Go)
│   ├── sdk/          # TypeScript SDK
│   └── function/     # Serverless functions
├── scripts/          # Build and utility scripts
├── docs/            # Documentation
└── configs/         # Configuration files
```

## 🛠️ Building

### Build Everything
```bash
./run.sh build all
```

### Build Individual Components
```bash
./run.sh build tui      # Build terminal UI
./run.sh build server   # Build CLI/server
./run.sh build desktop  # Build desktop app
```

### Arch Linux Desktop Build
For Arch Linux users with webkit2gtk-4.1:
```bash
./scripts/build/build-desktop-arch.sh
```

## 🎯 Features

- **Desktop Application**: Native desktop app built with Tauri
- **Auto-Detection**: Automatically detects running servers
- **Multi-Mode**: Terminal UI, desktop, or headless server
- **AI-Powered**: Advanced coding assistance
- **Theme Support**: Multiple color themes
- **MCP Integration**: Model Context Protocol support

## 📝 Configuration

Configuration files are stored in:
- `~/.config/kuuzuki/` - User configuration
- `~/.local/share/kuuzuki/` - Application data
- `~/.local/state/kuuzuki/` - Runtime state

## 🤝 Contributing

This is a fork of [OpenCode](https://github.com/sst/opencode). We aim to maintain compatibility while adding new features.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.