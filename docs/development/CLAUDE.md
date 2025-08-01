# Kuuzuki - Community Fork Development Guide

## Project Overview

Kuuzuki is a community-driven fork of OpenCode, focused on providing an npm-installable AI-powered terminal assistant. This project emphasizes terminal/CLI usage as the primary interface while maintaining compatibility with the original OpenCode.

### Fork Information
- **Original Project**: [OpenCode](https://github.com/sst/opencode) by SST
- **Fork Purpose**: Community-driven development and npm distribution
- **Primary Focus**: Terminal/CLI interface with AI assistance
- **Distribution**: NPM package for easy installation

## Architecture

### Main Components

1. **CLI Interface** (`packages/kuuzuki/src/index.ts`)
   - Main entry point for the kuuzuki command
   - Handles command routing (tui, run, serve, etc.)
   - Version management and configuration

2. **Terminal UI** (`packages/tui/`)
   - Go-based terminal UI for interactive sessions
   - Keyboard-driven interface with vim-like bindings
   - Real-time streaming with the backend server

3. **Server Component** (`packages/kuuzuki/src/server/`)
   - HTTP server for handling AI requests
   - Session management and context tracking
   - Tool execution and file system operations

### Key Features

- **NPM Distribution**: Install globally with `npm install -g kuuzuki`
- **AI Integration**: Built-in Claude support via API keys
- **Enhanced Context Management**: Improved context handling with proactive summarization at 85% threshold, better token estimation (3.5 chars/token), and dual-layer protection (see [Context Handling Documentation](docs/CONTEXT_HANDLING.md))
- **Multiple Modes**: TUI, CLI commands, and server mode
- **Community Focus**: Open to contributions and enhancements
- **Cross-Platform**: Works on macOS, Linux, and Windows

## Development Workflow

### Running in Development

```bash
# From root directory
bun dev

# Or run specific modes
./run.sh dev tui     # Terminal UI
./run.sh dev server  # Server mode
```

### Building

```bash
# Build all components
./run.sh build all

# Build specific components
./run.sh build tui     # Build Go TUI
./run.sh build server  # Build CLI/server
```

### Testing

When testing kuuzuki:
1. Verify TUI starts correctly
2. Test CLI commands (run, serve, etc.)
3. Ensure AI integration works with API keys
4. Test file operations and tool execution
5. Verify npm installation works properly

## Important Code Patterns

### Command Registration

Commands are registered using yargs:
```typescript
// In src/cli/cmd/tui.ts
export const TuiCommand = cmd({
  command: "tui [project]",
  describe: "start kuuzuki in terminal UI mode",
  handler: async (args) => {
    // Command implementation
  }
})
```

### Tool Development

Tools are implemented with schema validation:
```typescript
// In src/tool/mytool.ts
export const MyTool: Tool = {
  name: "my_tool",
  description: "Tool description",
  parameters: z.object({
    // Zod schema
  }),
  execute: async (args) => {
    // Tool implementation
  }
}
```

### Request Flow

1. User input in TUI or CLI
2. Request sent to server via HTTP
3. Server processes with AI/tools
4. Response streamed back to client
5. Display in terminal interface

## Common Issues & Solutions

### API Key Not Working

1. Ensure ANTHROPIC_API_KEY is set in environment
2. Check key validity and permissions
3. Verify network connectivity

### TUI Not Starting

1. Ensure Go binary is built: `./run.sh build tui`
2. Check terminal compatibility
3. Try with different terminal emulators

### NPM Installation Issues

1. Clear npm cache: `npm cache clean --force`
2. Use specific version: `npm install -g kuuzuki@0.1.0`
3. Check Node.js version (>=18.0.0 required)

## Key Files to Know

- `packages/kuuzuki/src/index.ts` - Main CLI entry point
- `packages/kuuzuki/src/cli/cmd/` - Command implementations
- `packages/kuuzuki/src/server/server.ts` - HTTP server
- `packages/kuuzuki/src/tool/` - Tool implementations
- `packages/tui/cmd/kuuzuki/main.go` - TUI entry point
- `packages/kuuzuki/script/publish.ts` - NPM publishing script

## Community Contributions

As a community fork, we welcome:

1. **Feature Additions**: New tools and capabilities
2. **Platform Support**: Better Windows/Linux support
3. **Integration**: IDE plugins, shell integrations
4. **Documentation**: Tutorials, guides, examples
5. **Translations**: Multi-language support

## Publishing Process

1. Update version in `package.json`
2. Create git tag: `git tag v0.1.0`
3. Push tag: `git push origin v0.1.0`
4. GitHub Actions will publish to npm

## Testing Checklist

When making changes, ensure:
- [ ] TUI starts and responds correctly
- [ ] CLI commands execute properly
- [ ] Server mode handles requests
- [ ] AI integration works with API key
- [ ] NPM package installs correctly
- [ ] Build completes successfully
- [ ] No TypeScript/Go errors
- [ ] Tests pass

## Commands Reference

```bash
# Development
bun dev                 # Run TUI in dev mode
./run.sh dev server     # Run server mode
./dev.sh watch         # Run with hot reload

# Building
./run.sh build all     # Build everything
./run.sh build tui     # Build Go TUI only
./run.sh build server  # Build CLI/server only

# Testing
bun test              # Run tests
bun typecheck         # Check TypeScript

# Publishing
bun run script/publish.ts --dry-run  # Test publish
bun run script/publish.ts            # Publish to npm
```

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.