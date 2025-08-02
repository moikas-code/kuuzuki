# Kuuzuki - AI-Powered Terminal Assistant

[![npm version](https://img.shields.io/npm/v/kuuzuki.svg)](https://www.npmjs.com/package/kuuzuki)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/kuuzuki.svg)](https://nodejs.org)

Kuuzuki is a community-driven fork of [OpenCode](https://github.com/sst/opencode), providing an AI-powered terminal assistant that integrates seamlessly with your development workflow. Built for improved reliability and extensibility, it offers a beautiful terminal UI, intelligent code assistance, and powerful file operations - all from your command line.

**Current Version**: 0.1.17 | **Repository**: [moikas-code/kuuzuki](https://github.com/moikas-code/kuuzuki)

## ✨ What's New in v0.1.17

### 🛡️ Intelligent Tool Fallback System

- **Improved Stability**: Eliminates `AI_NoSuchToolError` in most cases
- **Smart Resolution**: Automatically maps tool names (e.g., `kb_read` → `kb-mcp_kb_read`)
- **Graceful Alternatives**: Provides helpful suggestions when tools are unavailable
- **Analytics-Driven**: Built-in usage tracking for continuous improvement

### 🔧 Enhanced Reliability

- **Comprehensive Testing**: Full test suite with high success rates
- **Improved Error Handling**: Better handling of edge cases
- **Performance Optimized**: Fast tool resolution with intelligent caching
- **Well-Documented**: Comprehensive documentation and guides

## 🚀 Features

### Core Capabilities

- **Terminal-First Design**: Beautiful TUI (Terminal User Interface) with vim-like keybindings
- **AI-Powered Assistance**: Built-in Claude integration for intelligent code help
- **Multiple Modes**: Interactive TUI, direct CLI commands, and server mode
- **Smart File Operations**: Context-aware file reading, writing, and searching
- **Cross-Platform**: Works on macOS, Linux, and Windows

### Advanced Features

- **🛡️ Intelligent Tool Fallback System**: Reduces crashes on missing tools - automatically finds alternatives or provides helpful suggestions
- **🔌 MCP (Model Context Protocol) Support**: Extensible tool system with support for external MCP servers
- **📊 Usage Analytics**: Built-in analytics for tool usage patterns and optimization recommendations
- **🔧 Robust Error Handling**: Graceful degradation with actionable error messages
- **🚀 Performance Optimized**: Efficient tool resolution and caching for fast response times

### Community & Extensibility

- **Community-Driven**: Open to contributions and actively maintained
- **Plugin Architecture**: Easy integration with external tools and services
- **Comprehensive Testing**: Full test coverage with automated quality assurance

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
git clone https://github.com/moikas-code/kuuzuki.git
cd kuuzuki
bun install
./run.sh build all
```

## 🔧 Configuration

### API Key Setup

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

Or create a `.env` file in your project:

```env
ANTHROPIC_API_KEY=your-api-key-here
```

### MCP Server Configuration (Optional)

Kuuzuki supports external MCP servers for extended functionality. Create a `.mcp.json` file:

```json
{
  "mcpServers": {
    "kb-mcp": {
      "command": "kb",
      "args": ["serve", "--local"]
    },
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"]
    }
  }
}
```

### Agent Configuration

Customize behavior with `.agentrc`:

```yaml
# Example .agentrc configuration
tools:
  bash: true
  edit: true
  read: true
  write: true
mode: "build"
temperature: 0.7
```

## 🚀 Quick Start

### 1. Install & Configure

```bash
# Install globally
npm install -g kuuzuki

# Set your API key
export ANTHROPIC_API_KEY="your-api-key-here"
```

### 2. Start Using

```bash
# Launch interactive terminal UI
kuuzuki

# Or run a quick command
kuuzuki run "explain this error message"
```

### 3. Enjoy Reliability

- ✅ **Fewer crashes** on missing tools
- ✅ **Intelligent suggestions** when tools are unavailable
- ✅ **Better experience** with automatic tool resolution

## 💻 Usage Modes

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

| Key      | Action                                |
| -------- | ------------------------------------- |
| `i`      | Enter insert mode (type your message) |
| `Esc`    | Exit insert mode                      |
| `Enter`  | Send message (in insert mode)         |
| `Ctrl+C` | Clear current input                   |
| `Ctrl+D` | Exit application                      |
| `j/k`    | Navigate messages (vim-style)         |
| `G`      | Jump to bottom                        |
| `gg`     | Jump to top                           |

## 🏗️ Architecture & Reliability

### Intelligent Tool System

Kuuzuki features a sophisticated tool management system that ensures reliability:

```
Tool Request → Direct Match → Name Resolution → Functional Alternatives → Graceful Degradation
```

**Resolution Strategies:**

1. **Direct Match** (100% confidence) - Tool exists exactly as requested
2. **Exact Mapping** (100% confidence) - Known tool name mappings (e.g., `kb_read` → `kb-mcp_kb_read`)
3. **Functional Alternatives** (70-95% confidence) - Similar tools that achieve the same result
4. **Composite Solutions** (50-80% confidence) - Multi-step processes using available tools
5. **Graceful Degradation** (0% confidence) - Helpful guidance when no alternatives exist

### MCP Integration

- **Extensible**: Support for external Model Context Protocol servers
- **Automatic Discovery**: Detects and integrates available MCP tools
- **Fallback Ready**: Intelligent handling when MCP servers are unavailable

### Quality Assurance

- **100% Test Coverage**: Every scenario tested and verified
- **Performance Monitoring**: Built-in analytics for optimization
- **Error Recovery**: Comprehensive error handling with user-friendly messages

## 🛠️ Development

### Prerequisites

- Node.js >= 18.0.0
- Bun >= 1.0.0
- Go >= 1.21 (for TUI development)

### Running in Development

```bash
# Clone the repository
git clone https://github.com/moikas-code/kuuzuki.git
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
# Run all tests
bun test

# Run specific test suites
bun run test/tool-fallback.test.ts        # Tool fallback system tests
bun run test/session-integration.test.ts  # Session integration tests
bun run test/session-tools.test.ts        # Tool registration tests

# Type checking
bun typecheck

# Linting
bun lint

# Build verification
./run.sh build all
```

## 🤝 Contributing

We welcome contributions! As a community fork, we're especially interested in:

- 🌟 **New features and tools** - Extend functionality with new capabilities
- 🐛 **Bug fixes and improvements** - Help make kuuzuki more reliable
- 📚 **Documentation and tutorials** - Improve user experience
- 🔌 **MCP server integrations** - Add support for new external tools
- 🧪 **Testing and quality assurance** - Expand test coverage
- 🌍 **Internationalization** - Make kuuzuki accessible globally
- 🔧 **Platform-specific enhancements** - Optimize for different environments

### Recent Major Contributions

- **Tool Fallback System** (v0.1.15): Intelligent tool resolution preventing crashes
- **MCP Integration**: Support for external Model Context Protocol servers
- **Comprehensive Testing**: Full test suite with 100% success rate
- **Performance Optimizations**: Faster tool resolution and caching

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

### Tool Errors (Fixed in v0.1.15+)

**Previous versions** might crash with `AI_NoSuchToolError`. **Current version** includes an intelligent tool fallback system that:

- ✅ **Automatically resolves** tool name mismatches (e.g., `kb_read` → `kb-mcp_kb_read`)
- ✅ **Provides alternatives** when exact tools aren't available
- ✅ **Reduces crashes** - provides helpful guidance when tools are missing

If you encounter tool-related issues:

1. Update to the latest version:

   ```bash
   npm install -g kuuzuki@latest
   ```

2. Check tool availability:

   ```bash
   kuuzuki --help
   ```

3. Review analytics for optimization suggestions (built-in feature)

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

### MCP Server Issues

1. Verify MCP server configuration in `.mcp.json`
2. Check that MCP servers are installed and accessible
3. Review logs for connection issues

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Original Project**: [OpenCode](https://github.com/sst/opencode) by SST - The foundation that made kuuzuki possible
- **Runtime**: [Bun](https://bun.sh) - Fast JavaScript runtime and package manager
- **Terminal UI**: [Bubble Tea](https://github.com/charmbracelet/bubbletea) - Powerful TUI framework in Go
- **AI Integration**: [Anthropic Claude](https://www.anthropic.com) - Advanced AI capabilities
- **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io) - Extensible tool integration
- **Community**: All contributors who help make kuuzuki better every day

### Special Thanks

- **Tool Fallback System**: Comprehensive solution reducing crashes
- **Testing Framework**: Robust test suite with high success rates
- **Documentation**: Detailed guides and implementation documentation

## 📚 Documentation

- **[Tool Fallback System](docs/development/TOOL_FALLBACK_SYSTEM.md)** - Intelligent tool resolution architecture
- **[Test Reports](docs/development/TOOL_FALLBACK_TEST_REPORT.md)** - Comprehensive testing documentation
- **[Development Guide](docs/development/)** - Technical implementation details
- **[API Documentation](docs/openapi.json)** - OpenAPI specification

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/kuuzuki)
- [GitHub Repository](https://github.com/moikas-code/kuuzuki)
- [Issue Tracker](https://github.com/moikas-code/kuuzuki/issues)
- [Discussions](https://github.com/moikas-code/kuuzuki/discussions)

---

<p align="center">Made with ❤️ by the Kuuzuki Community</p>
