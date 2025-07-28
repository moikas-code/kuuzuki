# Development Setup Guide

## Running from Root Directory

### Quick Start (Development)
```bash
# Run TUI directly
bun dev

# Or use the run script
./run.sh dev tui

# Run server mode
./run.sh dev server 8080
```

## Setting up Bun Link for Global Access

### 1. Link the OpenCode Package
```bash
# From the opencode package directory
cd packages/opencode
bun link

# This creates a global symlink to the package
```

### 2. Create a Kuuzuki Alias
To use `kuuzuki` command globally, add this to the opencode package.json:

```json
"bin": {
  "opencode": "./bin/opencode",
  "kuuzuki": "./bin/opencode"
}
```

Then run `bun link` again.

### 3. Use the Linked Package
After linking, you can use the commands globally:

```bash
# Run from anywhere (TUI is the default)
kuuzuki
opencode

# Or specify other commands
kuuzuki serve --port 8080
opencode generate

# Still works with explicit tui command
kuuzuki tui
```

## Development Workflow

### For Active Development
1. **From project root:**
   ```bash
   # Direct execution (fastest for development) - TUI is default
   bun run packages/opencode/src/index.ts
   
   # Or use npm script
   bun dev
   ```

2. **With hot reload:**
   ```bash
   # Use bun's --watch flag
   bun --watch packages/opencode/src/index.ts tui
   ```

### For Testing CLI Commands
1. **Build the CLI:**
   ```bash
   ./run.sh build server
   ```

2. **Link for testing:**
   ```bash
   cd packages/opencode
   bun link
   ```

3. **Test globally:**
   ```bash
   kuuzuki tui
   kuuzuki serve --port 8080
   ```

## Project Structure for Development

```
kuucode/
├── package.json          # Root package with dev scripts
├── run.sh               # Build and run utilities
├── packages/
│   ├── opencode/        # Main CLI package
│   │   ├── src/         # Source code
│   │   ├── bin/         # Binary wrappers
│   │   └── package.json # Package definition
│   └── tui/             # Go TUI implementation
```

## Recommended VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug TUI",
      "runtimeExecutable": "bun",
      "program": "${workspaceFolder}/packages/opencode/src/index.ts",
      "args": ["tui"],
      "cwd": "${workspaceFolder}",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeExecutable": "bun",
      "program": "${workspaceFolder}/packages/opencode/src/index.ts",
      "args": ["serve", "--port", "8080"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

## Environment Variables for Development

Create a `.env` file in the root:

```bash
# Development settings
NODE_ENV=development
DEBUG=true

# API Keys (if needed)
ANTHROPIC_API_KEY=your_key_here
```

## Tips for Development

1. **Fast Iteration**: Use `bun run` directly on TypeScript files for fastest development cycle
2. **Type Checking**: Run `bun typecheck` regularly to catch type errors
3. **Testing**: Use `bun test` for running tests
4. **Building**: Only build when you need to test the compiled binary

## Troubleshooting

### Command Not Found After Linking
```bash
# Check if link exists
bun pm ls -g

# Re-link if needed
cd packages/opencode
bun unlink
bun link
```

### Permission Issues
```bash
# Make sure bin scripts are executable
chmod +x packages/opencode/bin/opencode
```