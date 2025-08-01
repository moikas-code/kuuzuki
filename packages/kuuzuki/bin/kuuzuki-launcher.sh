#!/bin/sh
set -e

if [ -n "$KUUZUKI_BIN_PATH" ]; then
    resolved="$KUUZUKI_BIN_PATH"
else
    # Get the real path of this script, resolving any symlinks
    script_path="$0"
    while [ -L "$script_path" ]; do
        link_target="$(readlink "$script_path")"
        case "$link_target" in
            /*) script_path="$link_target" ;;
            *) script_path="$(dirname "$script_path")/$link_target" ;;
        esac
    done
    script_dir="$(dirname "$script_path")"
    script_dir="$(cd "$script_dir" && pwd)"
    
    # Map platform names
    case "$(uname -s)" in
        Darwin) platform="darwin" ;;
        Linux) platform="linux" ;;
        MINGW*|CYGWIN*|MSYS*) platform="windows" ;;
        *) platform="$(uname -s | tr '[:upper:]' '[:lower:]')" ;;
    esac
    
    # Map architecture names  
    case "$(uname -m)" in
        x86_64|amd64) arch="x64" ;;
        aarch64|arm64) arch="arm64" ;;
        armv7l) arch="arm" ;;
        *) arch="$(uname -m)" ;;
    esac
    
    name="kuuzuki-${platform}-${arch}"
    binary="kuuzuki"
    [ "$platform" = "windows" ] && binary="kuuzuki.exe"
    
    # Search for the binary starting from real script location
    resolved=""
    current_dir="$script_dir"
    while [ "$current_dir" != "/" ]; do
        candidate="$current_dir/node_modules/$name/bin/$binary"
        if [ -f "$candidate" ]; then
            resolved="$candidate"
            break
        fi
        current_dir="$(dirname "$current_dir")"
    done
    
    if [ -z "$resolved" ]; then
        printf "It seems that your package manager failed to install the right version of the kuuzuki CLI for your platform. You can try manually installing the \"%s\" package\n" "$name" >&2
        exit 1
    fi
fi

# Handle SIGINT gracefully
trap '' INT

# Execute the binary with all arguments
exec "$resolved" "$@"