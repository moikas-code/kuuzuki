# Kuuzuki - AI-Powered Terminal Assistant

[![npm version](https://img.shields.io/npm/v/kuuzuki.svg)](https://www.npmjs.com/package/kuuzuki)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/kuuzuki.svg)](https://nodejs.org)

Kuuzuki is a community-driven fork of [OpenCode](https://github.com/sst/opencode), providing an AI-powered terminal assistant that integrates seamlessly with your development workflow. It offers a beautiful terminal UI, intelligent code assistance, and powerful file operations - all from your command line.

## 🚀 Features

- **Terminal-First Design**: Beautiful TUI (Terminal User Interface) with vim-like keybindings
- **AI-Powered Assistance**: Built-in Claude integration for intelligent code help
- **Multiple Modes**: Interactive TUI, direct CLI commands, and server mode
- **Smart File Operations**: Context-aware file reading, writing, and searching
- **Cross-Platform**: Works on macOS, Linux, and Windows
- **Community-Driven**: Open to contributions and actively maintained

## 📦 Installation

### Via npm (Recommended)

```bash
npm install -g kuuzuki
```

### Via Bun

```bash
bun install -g kuuzuki
```

### From Source

```bash
git clone https://github.com/kuuzuki/kuuzuki.git
cd kuuzuki
bun install
./run.sh build all
```

## 🔧 Configuration

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

Or create a `.env` file in your project:

```env
ANTHROPIC_API_KEY=your-api-key-here
```

## 💻 Usage

### Terminal UI Mode (Recommended)

Start the interactive terminal interface:

```bash
kuuzuki
```

Or specify a project directory:

```bash
kuuzuki /path/to/your/project
```

### CLI Commands

Execute AI commands directly:

```bash
kuuzuki run "explain this code" file.js
```

### Server Mode

Run as an HTTP server for programmatic access:

```bash
kuuzuki serve --port 3000
```

### Help

View all available commands:

```bash
kuuzuki --help
```

## ⌨️ Keyboard Shortcuts (TUI Mode)

| Key | Action |
|-----|--------|
| `i` | Enter insert mode (type your message) |
| `Esc` | Exit insert mode |
| `Enter` | Send message (in insert mode) |
| `Ctrl+C` | Clear current input |
| `Ctrl+D` | Exit application |
| `j/k` | Navigate messages (vim-style) |
| `G` | Jump to bottom |
| `gg` | Jump to top |

## 🛠️ Development

### Prerequisites

- Node.js >= 18.0.0
- Bun >= 1.0.0
- Go >= 1.21 (for TUI development)

### Running in Development
```bash
# Clone the repository
git clone https://github.com/kuuzuki/kuuzuki.git
cd kuuzuki

# Install dependencies
bun install

# Run in development mode
bun dev

# Run specific modes
./run.sh dev tui     # Terminal UI
./run.sh dev server  # Server mode
```

### Building

```bash
# Build all components
./run.sh build all

# Build specific components
./run.sh build tui     # Build Go TUI
./run.sh build server  # Build TypeScript server
```

### Testing

```bash
# Run tests
bun test

# Type checking
bun typecheck

# Linting
bun lint
```

## 🤝 Contributing

We welcome contributions! As a community fork, we're especially interested in:

- 🌟 New features and tools
- 🐛 Bug fixes and improvements
- 📚 Documentation and tutorials
- 🌍 Internationalization
- 🔧 Platform-specific enhancements

Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 🐛 Troubleshooting

### API Key Issues

1. Verify your API key is set correctly:
   ```bash
   echo $ANTHROPIC_API_KEY
   ```

2. Ensure the key has proper permissions

3. Check network connectivity to Anthropic's API

### TUI Not Starting

1. Rebuild the TUI binary:
   ```bash
   ./run.sh build tui
   ```

2. Check terminal compatibility (works best with modern terminals)

3. Try different terminal emulators if issues persist

### Installation Problems

1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```

2. Try installing with specific version:
   ```bash
   npm install -g kuuzuki@latest
   ```

3. Ensure Node.js version is >= 18.0.0

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original [OpenCode](https://github.com/sst/opencode) project by SST
- Built with [Bun](https://bun.sh) runtime
- Terminal UI powered by [Bubble Tea](https://github.com/charmbracelet/bubbletea)
- AI capabilities via [Anthropic Claude](https://www.anthropic.com)

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/kuuzuki)
- [GitHub Repository](https://github.com/kuuzuki/kuuzuki)
- [Issue Tracker](https://github.com/kuuzuki/kuuzuki/issues)
- [Discussions](https://github.com/kuuzuki/kuuzuki/discussions)

---

<p align="center">Made with ❤️ by the Kuuzuki Community</p>
