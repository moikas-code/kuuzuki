# Kuuzuki - Community Fork of OpenCode

[![npm version](https://badge.fury.io/js/kuuzuki.svg)](https://www.npmjs.com/package/kuuzuki)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Kuuzuki is a community-driven fork of [OpenCode](https://github.com/sst/opencode), focusing on making AI-powered terminal assistance accessible through npm and community contributions.

## 🌟 Why Kuuzuki?

Kuuzuki was created to:
- Provide an **npm-installable** version of OpenCode
- Enable **community-driven** development and features
- Maintain **compatibility** with OpenCode while adding new capabilities
- Focus on **terminal/CLI usage** as the primary interface

## 📦 Installation

```bash
# Install globally via npm
npm install -g kuuzuki

# Or use with npx
npx kuuzuki
```

## 🚀 Quick Start

```bash
# Start the TUI (Terminal UI)
kuuzuki

# Run a single command
kuuzuki run "explain this error"

# Start in server mode
kuuzuki serve --port 8080

# Check version
kuuzuki --version
```

## 🎯 Features

### Core Features (from OpenCode)
- **AI-Powered Assistance**: Built-in Claude integration for intelligent help
- **Terminal UI**: Clean, keyboard-driven interface
- **Multi-Mode Support**: TUI, CLI, and server modes
- **Smart Context**: Automatic context gathering from your project

### Community Additions
- **NPM Package**: Easy installation without building from source
- **Simplified Deployment**: Streamlined for terminal/CLI usage
- **Community Plugins**: (Coming soon) Extended functionality through plugins
- **Cross-Platform**: Works on macOS, Linux, and Windows

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/kuuzuki/kuuzuki.git
cd kuuzuki

# Install dependencies
bun install

# Run in development
bun dev

# Build all components
./run.sh build all

# Run tests
bun test
```

## 📁 Project Structure

```
kuuzuki/
├── packages/
│   ├── kuuzuki/      # Main CLI and server
│   ├── tui/          # Terminal UI (Go)
│   └── sdk/          # JavaScript SDK
├── .github/          # GitHub workflows
└── scripts/          # Build and utility scripts
```

## 🤝 Contributing

We welcome contributions! As a community fork, we're especially interested in:

- Bug fixes and improvements
- New features and integrations
- Documentation improvements
- Plugin development
- Platform-specific enhancements

Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## 📊 Stats

See [STATS.md](STATS.md) for download statistics and usage metrics.

## 🔗 Relationship with OpenCode

Kuuzuki is a fork of [OpenCode](https://github.com/sst/opencode) by SST. We maintain compatibility where possible and contribute improvements back upstream when appropriate.

### Key Differences:
- **Distribution**: NPM package vs build from source
- **Focus**: Terminal/CLI first vs multiple interfaces
- **Development**: Community-driven vs company-maintained
- **Deployment**: Simplified npm publishing vs multi-platform releases

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- The [SST team](https://sst.dev) for creating OpenCode
- All contributors to both OpenCode and Kuuzuki
- The open source community for feedback and support

---

**Note**: Kuuzuki is not officially affiliated with SST or Anthropic. It's a community project aimed at making AI-powered terminal assistance more accessible.