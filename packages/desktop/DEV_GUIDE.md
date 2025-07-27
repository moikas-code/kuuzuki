# Kuuzuki Desktop Development Guide

## Quick Start

### Option 1: Using npm scripts (Recommended)
```bash
# From the root directory
npm run dev:desktop
```

### Option 2: Direct start script
```bash
# From packages/desktop directory
npm run dev:start
```

### Option 3: Manual start
```bash
# Terminal 1: Start Vite
npm run dev:vite

# Terminal 2: Start Electron (after Vite is ready)
npm run dev:electron:wait
```

## Troubleshooting

### Electron doesn't launch
1. Make sure Vite is running on http://localhost:5174
2. Check if port 5174 is free: `npm run kill-port`
3. Try the manual start method (Option 3)

### Build errors
```bash
# Clean and rebuild
npm run cleanup
npm run rebuild:dev
```

### Testing different modes
- Press `Cmd+1` - Terminal only mode
- Press `Cmd+2` - Kuuzuki AI only mode  
- Press `Cmd+3` - Split view mode
- Press `Cmd+/` - Toggle between last two modes

### Debugging
- Electron logs appear in the terminal
- Open DevTools: `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Linux/Windows)
- Check the terminal output for errors

## Development Workflow

1. Start the dev server: `npm run dev:desktop`
2. Make changes to the code
3. Vite will hot-reload UI changes automatically
4. For main process changes, restart Electron

## Key Files
- `src/App.tsx` - Main UI component
- `src/components/MultiTerminal.tsx` - Terminal component
- `src/main/index.ts` - Main Electron process
- `src/main/terminal-manager.ts` - PTY management
- `src/main/plugin-loader.ts` - Plugin system