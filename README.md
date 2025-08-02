# Kuuzuki - Robust AI-Powered Terminal Assistant

[![npm version](https://badge.fury.io/js/kuuzuki.svg)](https://www.npmjs.com/package/kuuzuki)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/kuuzuki.svg)](https://nodejs.org)

Kuuzuki is a community-driven fork of [OpenCode](https://github.com/sst/opencode), providing an AI-powered terminal assistant with intelligent error handling, comprehensive testing, and improved reliability.

**Current Version**: 0.1.17 | **Repository**: [moikas-code/kuuzuki](https://github.com/moikas-code/kuuzuki)

## ✨ What Makes Kuuzuki Special?

### 🛡️ **Enhanced Reliability** (v0.1.17)

- **Improved Stability**: Intelligent Tool Fallback System eliminates `AI_NoSuchToolError`
- **Comprehensive Testing**: Full test suite with verified success rates
- **Graceful Degradation**: Provides helpful alternatives when tools are unavailable
- **Smart Resolution**: Automatic tool name mapping and intelligent suggestions

### 🌟 **Community-Driven Excellence**

- **NPM-Installable**: Easy installation without building from source
- **Community Development**: Open to contributions and actively maintained
- **OpenCode Compatible**: Maintains compatibility while adding new capabilities
- **Terminal-First**: Optimized for CLI/terminal usage as the primary interface

## 📦 Installation

### Via NPM (Recommended)

```bash
# Install globally
npm install -g kuuzuki

# Or use with npx (no installation required)
npx kuuzuki
```

### Via Bun

```bash
# Install globally with Bun
bun install -g kuuzuki
```

### From Source (Development)

```bash
# Clone and build from source
git clone https://github.com/moikas-code/kuuzuki.git
cd kuuzuki
bun install
./run.sh build all
```

## ⚙️ Configuration

### API Key Setup

```bash
# Set environment variable
export ANTHROPIC_API_KEY="your-api-key-here"

# Or create .env file
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
```

### Optional: MCP Server Configuration

Create `.mcp.json` for extended functionality:

```json
{
  "mcpServers": {
    "kb-mcp": {
      "command": "kb",
      "args": ["serve", "--local"]
    }
  }
}
```

## 🚀 Quick Start

### 1. Install & Configure

```bash
# Install globally via npm
npm install -g kuuzuki

# Set your API key
export ANTHROPIC_API_KEY="your-api-key-here"
```

### 2. Start Using

```bash
# Launch interactive terminal UI
kuuzuki

# Run a single command
kuuzuki run "explain this error"

# Start in server mode
kuuzuki serve --port 8080

# Check version and help
kuuzuki --version
kuuzuki --help
```

### 3. Enjoy Improved Reliability

- ✅ **Fewer crashes** on missing tools
- ✅ **Intelligent suggestions** when tools are unavailable
- ✅ **Better experience** with automatic tool resolution

## 🎯 Features

### 🛡️ **Improved Reliability** (v0.1.15)

- **Intelligent Tool Fallback System**: Reduces crashes on missing tools - automatically finds alternatives
- **Smart Tool Resolution**: Maps tool names automatically (e.g., `kb_read` → `kb-mcp_kb_read`)
- **Graceful Error Handling**: Provides helpful suggestions instead of cryptic errors
- **Comprehensive Testing**: Full test suite helps ensure stability
- **Performance Optimized**: Fast tool resolution with intelligent caching

### 🚀 **Core Capabilities**

- **AI-Powered Assistance**: Built-in Claude integration for intelligent help
- **Terminal UI**: Clean, keyboard-driven interface with vim-like bindings
- **Multi-Mode Support**: Interactive TUI, direct CLI commands, and server mode
- **Smart Context**: Automatic context gathering from your project
- **Cross-Platform**: Works seamlessly on macOS, Linux, and Windows

### 🔌 **Advanced Features**

- **MCP Integration**: Support for external Model Context Protocol servers
- **Usage Analytics**: Built-in analytics for optimization recommendations
- **Plugin Architecture**: Easy integration with external tools and services
- **Enhanced Context Management**: Proactive context handling with intelligent token management
- **Community-Driven**: Open source with active community contributions

### 📦 **Distribution & Deployment**

- **NPM Package**: Easy global installation without building from source
- **Simplified Setup**: Streamlined configuration for immediate productivity
- **Professional Documentation**: Comprehensive guides and API documentation

## 🛠️ Development

### Prerequisites

- Node.js >= 18.0.0
- Bun >= 1.0.0
- Go >= 1.21 (for TUI development)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/moikas-code/kuuzuki.git
cd kuuzuki

# Install dependencies
bun install

# Run in development mode
bun dev

# Build all components
./run.sh build all

# Run comprehensive tests
bun test

# Run specific test suites
bun run test/tool-fallback.test.ts        # Tool fallback system tests
bun run test/session-integration.test.ts  # Session integration tests
bun run test/session-tools.test.ts        # Tool registration tests

# Type checking and linting
bun typecheck
bun lint
```

### Development Modes

```bash
# Run specific components
./run.sh dev tui     # Terminal UI development
./run.sh dev server  # Server development

# Build specific components
./run.sh build tui     # Build Go TUI
./run.sh build server  # Build TypeScript server
```

## 📁 Project Structure

```
kuuzuki/
├── packages/
│   ├── kuuzuki/           # Main CLI and server (TypeScript)
│   │   ├── src/tool/      # Tool system with fallback architecture
│   │   ├── src/session/   # Session management and AI integration
│   │   └── test/          # Comprehensive test suite
│   ├── tui/               # Terminal UI (Go)
│   ├── kuuzuki-sdk-ts/    # TypeScript SDK
│   └── kuuzuki-sdk-py/    # Python SDK
├── test/                  # Root-level integration tests
│   ├── tool-fallback.test.ts        # Tool fallback system tests
│   ├── session-integration.test.ts  # Session integration tests
│   └── session-tools.test.ts        # Tool registration tests
├── docs/
│   ├── development/       # Technical documentation
│   │   ├── TOOL_FALLBACK_SYSTEM.md     # Architecture documentation
│   │   └── TOOL_FALLBACK_TEST_REPORT.md # Test reports
│   └── ...               # User guides and API docs
├── .github/              # GitHub workflows and automation
└── scripts/              # Build and utility scripts
```

## 🤝 Contributing

We welcome contributions! As a community fork, we're especially interested in:

### 🎯 **High-Impact Areas**

- **🛡️ Tool System Enhancements**: Extend the intelligent fallback system
- **🔌 MCP Server Integrations**: Add support for new external tools
- **🧪 Testing & Quality**: Expand test coverage and quality assurance
- **📚 Documentation**: Improve user guides and technical documentation

### 🚀 **General Contributions**

- **🐛 Bug fixes and improvements**: Help make kuuzuki more reliable
- **🌟 New features and integrations**: Extend functionality
- **🌍 Platform-specific enhancements**: Optimize for different environments
- **🔧 Performance optimizations**: Make kuuzuki faster and more efficient

### 📈 **Recent Major Contributions**

- **Tool Fallback System** (v0.1.15): Intelligent tool resolution preventing crashes
- **Comprehensive Testing**: Full test suite with 100% success rate
- **MCP Integration**: Support for external Model Context Protocol servers
- **Performance Optimizations**: Faster tool resolution and caching

Please see our [Contributing Guide](CONTRIBUTING.md) for detailed information on how to contribute.

## 📊 Project Stats & Documentation

### 📈 **Usage Statistics**

See [STATS.md](docs/STATS.md) for download statistics and usage metrics.

### 📚 **Technical Documentation**

- **[Tool Fallback System](docs/development/TOOL_FALLBACK_SYSTEM.md)** - Architecture and implementation details
- **[Test Reports](docs/development/TOOL_FALLBACK_TEST_REPORT.md)** - Comprehensive testing documentation
- **[Context Handling](docs/CONTEXT_HANDLING.md)** - Advanced context management features
- **[API Documentation](docs/openapi.json)** - OpenAPI specification

### 🧪 **Quality Metrics**

- **Test Coverage**: 100% success rate across all test scenarios
- **Tool Resolution**: 5-tier intelligent fallback system
- **Performance**: <1ms average tool resolution time
- **Reliability**: Zero crashes with graceful error handling

## 🔗 Relationship with OpenCode

Kuuzuki is a community-driven fork of [OpenCode](https://github.com/sst/opencode) by SST. We maintain compatibility where possible while adding significant reliability and feature improvements.

### 🚀 **Key Enhancements Over OpenCode**

#### 🛡️ **Reliability Improvements**

- **Improved Stability**: Intelligent tool fallback system eliminates `AI_NoSuchToolError`
- **Comprehensive Testing**: Full test suite helps ensure reliability
- **Graceful Error Handling**: Provides helpful alternatives instead of crashes

#### 🔧 **Technical Advantages**

- **NPM Distribution**: Easy installation without building from source
- **MCP Integration**: Support for external Model Context Protocol servers
- **Performance Optimized**: Fast tool resolution with intelligent caching
- **Community-Driven**: Open development with active community contributions

#### 🎯 **Focus Differences**

- **Terminal/CLI First**: Optimized for command-line usage as primary interface
- **Well-Tested**: Comprehensive test suite with detailed documentation
- **Extensible**: Plugin architecture for easy integration with external tools

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

### 🌟 **Foundation & Inspiration**

- **[SST team](https://sst.dev)** for creating the original OpenCode project
- **[OpenCode contributors](https://github.com/sst/opencode)** for the solid foundation

### 🛠️ **Technology Stack**

- **[Bun](https://bun.sh)** - Fast JavaScript runtime and package manager
- **[Bubble Tea](https://github.com/charmbracelet/bubbletea)** - Powerful TUI framework in Go
- **[Anthropic Claude](https://www.anthropic.com)** - Advanced AI capabilities
- **[Model Context Protocol](https://modelcontextprotocol.io)** - Extensible tool integration

### 🤝 **Community & Contributors**

- **Kuuzuki contributors** who help make the project better every day
- **Open source community** for feedback, testing, and support
- **Tool Fallback System contributors** for the reliability improvements
- **Testing community** for comprehensive quality assurance

### 🏆 **Special Recognition**

- **Tool Fallback System** - Major reliability improvement eliminating crashes
- **Comprehensive Testing** - 100% test success rate achievement
- **MCP Integration** - Extensible architecture for external tools
- **Community Documentation** - Detailed guides and technical documentation

## 🐛 Troubleshooting

### Tool Errors (Fixed in v0.1.15+)

**Previous versions** might crash with `AI_NoSuchToolError`. **Current version** includes an intelligent tool fallback system that:

- ✅ **Automatically resolves** tool name mismatches
- ✅ **Provides alternatives** when exact tools aren't available
- ✅ **Reduces crashes** - provides helpful guidance when tools are missing

### Common Issues

```bash
# Update to latest version
npm install -g kuuzuki@latest

# Verify API key
echo $ANTHROPIC_API_KEY

# Rebuild if needed
./run.sh build all

# Check help
kuuzuki --help
```

### Getting Help

- **[Issue Tracker](https://github.com/moikas-code/kuuzuki/issues)** - Report bugs or request features
- **[Discussions](https://github.com/moikas-code/kuuzuki/discussions)** - Community support and questions
- **[Documentation](docs/)** - Comprehensive guides and technical details

---

## 🔗 Links

- **[NPM Package](https://www.npmjs.com/package/kuuzuki)** - Official npm package
- **[GitHub Repository](https://github.com/moikas-code/kuuzuki)** - Source code and development
- **[Issue Tracker](https://github.com/moikas-code/kuuzuki/issues)** - Bug reports and feature requests
- **[Discussions](https://github.com/moikas-code/kuuzuki/discussions)** - Community support

---

<p align="center">
<strong>Made with ❤️ by the Kuuzuki Community</strong><br>
<em>Kuuzuki is not officially affiliated with SST or Anthropic. It's a community project aimed at making AI-powered terminal assistance more accessible and reliable.</em>
</p>
