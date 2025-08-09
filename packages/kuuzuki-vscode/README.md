# Kuuzuki for VS Code

AI-powered coding assistant extension for Visual Studio Code.

## Features

- **Open Kuuzuki in Terminal**: Launch kuuzuki directly in VS Code's integrated terminal
- **Run with Current File**: Execute kuuzuki with the currently active file
- **Start Kuuzuki Server**: Launch the kuuzuki server for API access
- **Open Kuuzuki TUI**: Launch the interactive terminal UI
- **Status Bar Integration**: Quick access to kuuzuki from the status bar

## Commands

- `Kuuzuki: Open Kuuzuki in Terminal` - Opens kuuzuki in a new terminal
- `Kuuzuki: Run with Current File` - Runs kuuzuki with the active file
- `Kuuzuki: Start Kuuzuki Server` - Starts the kuuzuki server
- `Kuuzuki: Open Kuuzuki TUI` - Opens the interactive TUI

## Keybindings

- `Ctrl+Shift+K` (Windows/Linux) / `Cmd+Shift+K` (Mac) - Open Kuuzuki TUI

## Context Menus

Right-click on files in the explorer or editor to access kuuzuki commands for supported file types (js, ts, py, go, rs, md).

## Requirements

- kuuzuki CLI must be installed and available in your PATH
- VS Code 1.74.0 or higher

## Installation

### From Source (Development)

1. Clone the kuuzuki repository
2. Navigate to `packages/kuuzuki-vscode`
3. Run `npm install`
4. Run `npm run build`
5. Press F5 to launch a new VS Code window with the extension loaded

### Building and Packaging

```bash
npm run build        # Build the extension
npm run watch        # Build and watch for changes
npm run package      # Create .vsix package
npm run publish      # Publish to VS Code marketplace
```

## Development

The extension is built with TypeScript and uses esbuild for fast compilation.

### Project Structure

```
src/
  extension.ts       # Main extension entry point
.vscode/
  launch.json        # VS Code debug configuration
  tasks.json         # Build tasks
package.json         # Extension manifest
```

## License

MIT