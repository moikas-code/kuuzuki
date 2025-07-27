# Kuuzuki Desktop - Next-Gen Terminal Development Guide

## Project Overview

Kuuzuki Desktop is a revolutionary terminal application that combines traditional command-line interfaces with built-in AI assistance. It's built on Electron with React and features a sophisticated plugin system.

## Architecture

### Main Components

1. **Terminal Manager** (`packages/desktop/src/main/terminal-manager.ts`)
   - Manages two PTY instances: one for bash/zsh, one for Kuuzuki AI
   - Handles mode switching between Terminal, Kuuzuki, and Split modes
   - Provides context sharing (directory sync, command history, environment)
   - Graceful fallback when node-pty is unavailable

2. **Multi-Terminal UI** (`packages/desktop/src/components/MultiTerminal.tsx`)
   - React component managing two xterm.js instances
   - Three view modes with smooth transitions
   - Focus management for split mode
   - Real-time terminal data routing

3. **Plugin System** (`packages/desktop/src/main/plugin-loader.ts`)
   - Sandboxed plugin execution using VM2
   - Permission-based security model
   - Rich API for terminal, AI, UI, and workspace access
   - Plugin manifest validation and lifecycle management

### Key Features

- **Multi-Mode Terminal**: Terminal-only, Kuuzuki-only, or split view
- **Context Sharing**: Automatic directory sync, shared command history
- **Plugin Architecture**: Extensible with JavaScript/TypeScript plugins
- **Keyboard Shortcuts**: Cmd+1/2/3 for mode switching, Cmd+/ for toggle
- **macOS-like UI**: Clean, minimal design with VS Code aesthetics

## Development Workflow

### Running in Development

```bash
# From root directory
npm run dev:desktop

# Or using the run script
./run.sh dev desktop
```

### Building

```bash
# Build desktop app
npm run build:desktop

# Build all components
./run.sh build all
```

### Testing

When testing the desktop app:
1. Check all three modes work (Terminal, Kuuzuki, Split)
2. Verify keyboard shortcuts
3. Test terminal output and input
4. Ensure directory sync works in split mode
5. Verify plugins load correctly

## Important Code Patterns

### IPC Communication

Main process exposes APIs through preload script:
```typescript
// Main process
ipcMain.handle('terminal-init', async () => {
    const kuuzukiBinary = await findKuuzukiBinary();
    await terminalManager.initialize(kuuzukiBinary);
    return { success: true };
});

// Renderer process
await window.electronAPI.initTerminal();
```

### Plugin Development

Plugins follow a specific structure:
```javascript
module.exports = {
    activate(context) {
        // Plugin initialization
        context.terminal.writeLine('Plugin activated!');
    },
    deactivate() {
        // Cleanup
    }
};
```

### Terminal Data Flow

1. User types in xterm.js terminal
2. Data sent via IPC to main process
3. Terminal manager routes to appropriate PTY
4. PTY output sent back via IPC
5. Rendered in xterm.js

## Common Issues & Solutions

### Port Already in Use

The app includes automatic port cleanup:
- `scripts/kill-port.js` - Kills processes on port 5174
- `scripts/cleanup-dev.sh` - Comprehensive cleanup script
- Run `npm run cleanup` if ports are stuck

### Electron Not Launching

1. Check Electron is properly installed: `ls node_modules/.bin/electron`
2. Try system Electron: `npm run dev:system`
3. Rebuild native modules: `npm run rebuild:dev`

### PTY Module Issues

The app gracefully falls back to child_process if node-pty fails:
- Check for MODULE_VERSION mismatch errors
- Run `electron-rebuild -f -w node-pty`
- App will still work without PTY, just with limited features

## Key Files to Know

- `src/main/index.ts` - Main Electron process
- `src/main/terminal-manager.ts` - Terminal PTY management
- `src/App.tsx` - Main React app with mode switching
- `src/components/MultiTerminal.tsx` - Terminal rendering component
- `src/main/plugin-loader.ts` - Plugin system implementation
- `src/preload/index.ts` - IPC bridge between main and renderer

## Future Enhancements

1. **Plugin Marketplace**: Central repository for community plugins
2. **Cloud Sync**: Settings and plugin sync across devices
3. **Collaborative Sessions**: Share terminal sessions with team
4. **Voice Commands**: Natural language terminal control
5. **Mobile App**: Companion app for remote access

## Testing Checklist

When making changes, ensure:
- [ ] All three modes work correctly
- [ ] Keyboard shortcuts function
- [ ] Terminal input/output works
- [ ] Directory sync in split mode
- [ ] Plugins load without errors
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] Port cleanup works

## Commands Reference

```bash
# Development
npm run dev:desktop      # Run in dev mode
npm run dev:clean       # Clean start with port cleanup
npm run cleanup         # Manual cleanup

# Building
npm run build:desktop   # Build desktop app
npm run package        # Create distributable

# Testing
npm run typecheck      # Check TypeScript
npm run lint          # Run linter
```