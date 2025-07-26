# Building Kuuzuki Desktop on Arch Linux

The desktop app uses Tauri v1 which requires webkit2gtk-4.0, but Arch Linux only provides webkit2gtk-4.1.

## Options:

### Option 1: Use the compatibility script (requires sudo)
```bash
sudo ./scripts/build/build-desktop-arch-final.sh
```

This script temporarily creates symlinks to make webkit2gtk-4.1 appear as 4.0.

### Option 2: Install webkit2gtk-4.0 from AUR
```bash
yay -S webkit2gtk-4.0
# Then build normally:
./run.sh build desktop
```

### Option 3: Build without desktop app
```bash
# Build only TUI and server
./run.sh build tui
./run.sh build server
```

### Option 4: Use the pre-built webkit fix script
```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 ./build-with-webkit-fix.sh build desktop
```

Note: This may still fail due to linker issues with Tauri v1.

## Recommendation

For now, the most reliable option on Arch Linux is Option 1 (using sudo) or Option 3 (skip desktop build).

The project may need to be upgraded to Tauri v2 for proper Arch Linux support without workarounds.
EOF < /dev/null
