# Kuuzuki Desktop Quick Start

## Running in Development Mode

```bash
# From project root
npm run dev:desktop
```

This new script will:
- Clean up port 5174
- Check/build the kuuzuki binary
- Compile TypeScript files
- Start Vite dev server
- Launch Electron automatically

## Running in Production Mode

```bash
# First build the app
npm run build:desktop

# Then run it
npm run start:desktop
# or
npm run run:desktop
```

## Troubleshooting

### Electron doesn't start
- Make sure you have a display connected (or use X11 forwarding over SSH)
- Check console for errors
- Try running `./dev-desktop.sh` directly for more verbose output

### Terminal shows "crashed"
- This usually means the IPC connection failed
- Check the console for specific error messages
- Make sure the kuuzuki binary exists in `packages/desktop/assets/bin/`

### TUI width not responsive
- The terminal resize signals are being sent
- Some terminals may need a refresh (try pressing Enter)
- Known issue with child_process fallback when node-pty isn't available

## Keyboard Shortcuts

- `Cmd+1` / `Ctrl+1` - Terminal only mode
- `Cmd+2` / `Ctrl+2` - Kuuzuki AI only mode
- `Cmd+3` / `Ctrl+3` - Split view mode
- `Cmd+/` / `Ctrl+/` - Toggle between modes