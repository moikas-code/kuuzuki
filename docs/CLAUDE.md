# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kuuzuki (formerly Kuucode) is an AI coding agent built for the terminal. It's a monorepo containing multiple packages including a CLI tool, desktop app, web interface, and terminal UI. Always check and use MCP Tools First.

## Development Commands

### Setup and Installation
```bash
# Install dependencies (uses Bun package manager)
bun install

# Run development server
bun run dev                    # Runs packages/kuuzuki/src/index.ts
```

### Build Commands (Unified)
```bash
# 🚀 New unified build script (recommended)
cd packages/kuuzuki

./build.sh                    # Build everything (default)
./build.sh all                # Build everything
./build.sh tui                # Build only TUI binary
./build.sh desktop            # Build only desktop binary
./build.sh help               # Show help and options

# Or use npm scripts
npm run build                 # Build everything
npm run build:tui            # Build only TUI
npm run build:desktop        # Build only desktop
```

### Development Commands

```bash
# 🚀 Start full desktop development environment (recommended)
cd packages/desktop
npm run dev                    # Starts server + desktop app together

# Individual development modes
cd packages/kuuzuki && bun run dev  # Run server only (port 4096)
cd packages/desktop && npm run dev:tauri  # Run desktop app only
cd packages/tui && ./kuuzuki-tui    # Run TUI standalone

# Other development tasks
bun run typecheck              # Type checking
bun run generate-sdks          # Update OpenAPI client SDKs
```

### Testing
```bash
# Run tests (using Bun test runner)
bun test                       # Run all tests
bun test tool/edit.test.ts     # Run specific test file
```

### Server and Port Configuration
- **Main Kuuzuki server**: Runs on port **4096** (NOT 3000)
- **Desktop app**: Uses Tauri framework
- **Web interface**: Standard web development setup

## Architecture Overview

### Monorepo Structure
```
packages/
├── kuuzuki/        # Core CLI and server implementation
├── tui/            # Terminal UI (Go + Bubble Tea)
├── desktop/        # Desktop app (Tauri + React)
├── web/            # Web interface
├── function/       # Serverless functions
└── kb/             # Knowledge base functionality

sdks/               # Generated client SDKs
├── typescript/
├── python/
└── github/
```

### Core Components

#### 1. CLI and Server (`packages/kuuzuki`)
- Entry point: `src/index.ts`
- Server implementation: `src/server/server.ts`
- Session management: `src/session/`
- Tool system: `src/tool/` (file operations, code editing)
- MCP (Model Context Protocol) support: `src/mcp/`
- Provider abstraction: `src/provider/` (supports multiple AI providers)

#### 2. Terminal UI (`packages/tui`)
- Built with Go and Bubble Tea framework
- Communicates with kuuzuki server via REST API
- Features vim keybindings, file explorer, syntax highlighting
- **Important**: Must set `KUUZUKI_SERVER=http://localhost:4096`

#### 3. Communication Flow
```
TUI/Desktop/Web → REST API → Kuuzuki Server → AI Provider
                     ↓
                OpenAPI SDK
```

### Key Implementation Details

#### Session and Message Architecture
- Sessions track conversation state and context
- Messages use a parts-based system for text and file attachments
- Server-Sent Events (SSE) for streaming responses
- Session persistence and sharing capabilities

#### Tool System
- Tools provide file operations, code editing, and system interactions
- Each tool has validation, execution, and result handling
- Tools can be extended via MCP servers

#### Provider System
- Abstraction layer for different AI providers (Anthropic, OpenAI, etc.)
- Configurable models and capabilities
- Rate limiting and token management

## Critical Configuration

### Environment Variables
- `KUUZUKI_SERVER`: Server URL (default: `http://localhost:4096`)
- `KUUZUKI_LOG_LEVEL`: Logging verbosity
- Provider-specific keys (e.g., `ANTHROPIC_API_KEY`)

### Common Issues and Solutions

1. **404 Errors in TUI**: Ensure server is running on port 4096, not 3000
2. **Session Creation Failures**: Check provider configuration and API keys
3. **Build Failures**: Ensure Bun is installed and dependencies are up to date

## Testing Strategy

When making changes:
1. Run type checking: `bun run typecheck`
2. Test the specific component you modified
3. For TUI changes: Build and test with actual server connection
4. For server changes: Test with TUI or use the CLI directly

## Release Process

The project uses semantic versioning and automated CI/CD:
- GitHub Actions handle testing and deployment
- Desktop builds use Tauri's build system
- npm packages are published automatically on release