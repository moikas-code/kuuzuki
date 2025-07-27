# Kuuzuki - Next-Generation Terminal with Built-in AI

Kuuzuki is a revolutionary terminal application that seamlessly integrates traditional command-line interfaces with AI assistance, creating a powerful development environment for the modern developer.

## 🚀 Features

### 🎯 Multi-Mode Terminal
- **Terminal Mode**: Full-screen traditional bash/zsh terminal
- **Kuuzuki Mode**: Full-screen AI assistant with natural language interface
- **Split Mode**: Side-by-side view with both terminals for maximum productivity

### 🤖 Built-in AI Integration
- Natural language to command translation
- Real-time error explanations and debugging assistance
- Context-aware suggestions based on your current work
- Seamless switching between manual and AI-assisted workflows

### ⚡ Smart Context Sharing
- Automatic directory synchronization between terminals
- Shared command history across modes
- Environment variable propagation
- Real-time context updates for better AI assistance

### 🔌 Extensible Plugin System
- JavaScript/TypeScript-based plugins with sandboxed execution
- Rich API for terminal manipulation, AI queries, and UI extensions
- Permission-based security model
- Example plugins included:
  - **File Explorer**: Navigate and manage files with terminal integration
  - **Browser Preview**: Preview web pages and localhost servers

### ⌨️ Keyboard-First Design
- `Cmd+1`: Switch to Terminal mode
- `Cmd+2`: Switch to Kuuzuki AI mode
- `Cmd+3`: Switch to Split mode
- `Cmd+/`: Quick toggle between modes

## 📁 Project Structure

```
kuucode/
├── packages/
│   ├── desktop/          # Electron desktop application
│   │   ├── src/
│   │   │   ├── main/     # Main process (terminal management, plugins)
│   │   │   ├── renderer/ # React UI components
│   │   │   └── plugins/  # Plugin system types and API
│   │   └── example-plugins/
│   ├── opencode/         # Core CLI and TUI
│   ├── tui/             # Terminal UI (Go)
│   ├── web/             # Web interface
│   └── sdk/             # TypeScript SDK
├── scripts/             # Build and utility scripts
├── docs/               # Documentation
└── run.sh              # Main build/run script
```

## 🛠️ Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/moikas-code/kuucode.git
cd kuucode

# Install dependencies
bun install

# Build the desktop app
npm run build:desktop
```

### Running in Development

```bash
# Run the desktop app in development mode
npm run dev:desktop

# Run the CLI version
npm run dev

# Run the TUI version
npm run dev:tui

# Run the server
npm run dev:server
```

### Building for Production

```bash
# Build everything
./run.sh build all

# Build specific components
./run.sh build desktop  # Electron desktop app
./run.sh build tui      # Terminal UI
./run.sh build server   # Server component

# Or use npm scripts
npm run build:desktop
npm run build:tui
npm run build:server
```

## 🏗️ Architecture

Kuuzuki is built with modern technologies:

- **Frontend**: React + TypeScript + Vite
- **Desktop**: Electron with native PTY support
- **Terminal**: xterm.js with custom integrations
- **AI Integration**: Kuuzuki AI engine
- **Plugin System**: Sandboxed JavaScript execution with VM2
- **Backend**: Node.js with MCP (Model Context Protocol) support

### Key Components

1. **Terminal Manager** (`src/main/terminal-manager.ts`)
   - Manages dual PTY instances for bash and Kuuzuki
   - Handles mode switching and focus management
   - Provides context sharing between terminals

2. **Multi-Terminal UI** (`src/components/MultiTerminal.tsx`)
   - React component for terminal rendering
   - Supports three view modes with smooth transitions
   - Handles keyboard shortcuts and user interactions

3. **Plugin System** (`src/main/plugin-loader.ts`)
   - Loads and manages plugins from `~/.kuuzuki/plugins`
   - Sandboxed execution environment
   - Rich API for plugin developers

## 🔌 Plugin Development

Create custom plugins to extend Kuuzuki's functionality:

### Plugin Structure

```javascript
// package.json
{
  "id": "my-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Adds awesome features to Kuuzuki",
  "main": "index.js",
  "permissions": [
    "terminal.write",
    "terminal.read",
    "ai.query"
  ],
  "activationEvents": ["onStartup"],
  "contributes": {
    "commands": [{
      "command": "myPlugin.doSomething",
      "title": "Do Something Awesome",
      "category": "My Plugin"
    }],
    "keybindings": [{
      "command": "myPlugin.doSomething",
      "key": "ctrl+shift+a"
    }]
  }
}

// index.js
module.exports = {
  activate(context) {
    console.log('My plugin is now active!');
    
    // Write to terminal
    context.terminal.writeLine('Hello from my plugin!');
    
    // Listen to terminal input
    context.subscriptions.push(
      context.terminal.onData((data) => {
        if (data.includes('hello')) {
          context.terminal.writeLine('Hello there!');
        }
      })
    );
    
    // Use AI
    context.subscriptions.push(
      context.commands.registerCommand('myPlugin.askAI', async () => {
        const response = await context.ai.query('What is the meaning of life?');
        context.terminal.writeLine(`AI says: ${response}`);
      })
    );
  },
  
  deactivate() {
    console.log('My plugin is now deactivated');
  }
};
```

### Available Plugin APIs

#### Terminal API
- `write(data)` - Write raw data to terminal
- `writeLine(line)` - Write a line to terminal
- `onData(callback)` - Listen for terminal input
- `executeCommand(cmd)` - Execute a command and get output
- `getCurrentDirectory()` - Get current working directory

#### AI API
- `query(prompt, options)` - Query the AI model
- `getContext()` - Get current AI context
- `streamQuery(prompt, callback)` - Stream AI responses

#### UI API
- `showMessage(message, type)` - Show notification
- `showInputBox(options)` - Get user input
- `createWebviewPanel(id, title)` - Create a webview panel
- `createStatusBarItem(alignment)` - Add status bar item

#### Workspace API
- `getWorkspaceFolder()` - Get workspace directory
- `findFiles(pattern)` - Find files by pattern
- `onDidChangeWorkspaceFolders(callback)` - Monitor workspace changes

### Plugin Installation

1. Create a folder in `~/.kuuzuki/plugins/your-plugin-name/`
2. Add your `package.json` and `index.js` files
3. Restart Kuuzuki or activate the plugin from the UI

## 🎨 Themes and Customization

Kuuzuki supports custom themes and appearance customization:

- Dark mode by default with VS Code-inspired theme
- Customizable terminal colors
- Plugin-provided themes
- Adjustable font size and family

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Configuration

Configuration files are stored in:
- `~/.config/kuuzuki/` - User configuration
- `~/.local/share/kuuzuki/` - Application data
- `~/.kuuzuki/plugins/` - Installed plugins

## 🔒 Security

- Plugins run in sandboxed environments
- Permission-based access control
- No network access without explicit permission
- Code execution limited to plugin context

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Forked from [OpenCode](https://github.com/sst/opencode) with significant enhancements
- Built with ❤️ by the Kuuzuki Team
- Inspired by modern developer tools and AI advancements
- Special thanks to all contributors and plugin developers

## 🚧 Roadmap

- [ ] Cloud sync for settings and plugins
- [ ] Collaborative terminal sessions
- [ ] Advanced AI model selection
- [ ] Visual debugging integration
- [ ] Mobile companion app
- [ ] Voice command support