#!/bin/bash
# Kuuzuki Build & Run Script
# This script handles building and running the entire kuuzuki project
# Usage: ./run.sh [command] [options]

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Function to check dependencies
check_dependencies() {
    print_header "Checking Dependencies"

    local missing_deps=()

    # Check for bun
    if ! command -v bun &> /dev/null; then
        missing_deps+=("bun")
    else
        print_success "Bun is installed ($(bun --version))"
    fi

    # Check for Go (needed for TUI/CLI)
    if ! command -v go &> /dev/null; then
        missing_deps+=("go")
    else
        print_success "Go is installed ($(go version | cut -d' ' -f3))"
    fi

    # Check for Node.js (needed for Electron desktop app)
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    else
        print_success "Node.js is installed ($(node --version))"
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        echo "Please install missing dependencies:"
        [[ " ${missing_deps[@]} " =~ " bun " ]] && echo "  - Bun: curl -fsSL https://bun.sh/install | bash"
        [[ " ${missing_deps[@]} " =~ " go " ]] && echo "  - Go: https://golang.org/dl/"
        [[ " ${missing_deps[@]} " =~ " node " ]] && echo "  - Node.js: https://nodejs.org/ or via your package manager"
        exit 1
    fi
}

# Function to install dependencies
install_deps() {
    print_header "Installing Dependencies"

    print_info "Installing npm dependencies..."
    bun install
    print_success "Dependencies installed"
}

# Function to build the TUI
build_tui() {
    print_header "Building TUI"

    cd "$SCRIPT_DIR/packages/tui"
    print_info "Building Go TUI binary..."
    go build -o kuuzuki-tui ./cmd/opencode

    # Copy to required locations
    cp kuuzuki-tui ./cmd/opencode/opencode
    mkdir -p "$SCRIPT_DIR/packages/opencode/binaries"
    cp kuuzuki-tui "$SCRIPT_DIR/packages/opencode/binaries/kuuzuki-tui-linux"

    print_success "TUI built successfully"
    cd "$SCRIPT_DIR"
}

# Function to build the server/CLI
build_server() {
    print_header "Building Server/CLI"

    cd "$SCRIPT_DIR/packages/opencode"
    print_info "Compiling kuuzuki with bun..."

    bun build ./src/index.ts \
        --compile \
        --target=bun \
        --outfile=kuuzuki-cli

    chmod +x kuuzuki-cli
    print_success "Server/CLI built successfully"
    cd "$SCRIPT_DIR"
}

# Function to build the desktop app
build_desktop() {
    print_header "Building Desktop App"

    # First ensure we have the CLI binary built
    if [ ! -f "$SCRIPT_DIR/packages/opencode/kuuzuki-cli" ]; then
        print_info "Building kuuzuki CLI first..."
        build_server
    fi

    # Copy the binary to desktop resources
    mkdir -p "$SCRIPT_DIR/packages/desktop/assets/bin"
    cp "$SCRIPT_DIR/packages/opencode/kuuzuki-cli" "$SCRIPT_DIR/packages/desktop/assets/bin/kuuzuki"
    chmod +x "$SCRIPT_DIR/packages/desktop/assets/bin/kuuzuki"

    # Build with Electron
    cd "$SCRIPT_DIR/packages/desktop"
    print_info "Building Electron desktop app..."
    npm run package

    print_success "Desktop app built successfully"
    print_info "Build artifacts in: packages/desktop/dist-electron/"
    cd "$SCRIPT_DIR"
}

# Function to run in development mode
run_dev() {
    print_header "Running in Development Mode"

    case "$1" in
        "server")
            print_info "Starting kuuzuki server..."
            cd "$SCRIPT_DIR/packages/opencode"
            bun run src/index.ts serve --port ${2:-4096}
            ;;
        "tui")
            print_info "Starting kuuzuki TUI..."
            cd "$SCRIPT_DIR/packages/opencode"
            bun run src/index.ts
            ;;
        "desktop")
            print_info "Starting desktop app in development mode..."
            cd "$SCRIPT_DIR/packages/desktop"
            npm run dev
            ;;
        *)
            print_info "Starting kuuzuki (default: TUI mode)..."
            cd "$SCRIPT_DIR/packages/opencode"
            bun run src/index.ts
            ;;
    esac
}

# Function to run production builds
run_prod() {
    print_header "Running Production Build"

    case "$1" in
        "server")
            print_info "Starting kuuzuki server..."
            "$SCRIPT_DIR/packages/opencode/kuuzuki-cli" serve --port ${2:-4096}
            ;;
        "tui")
            print_info "Starting kuuzuki TUI..."
            "$SCRIPT_DIR/packages/opencode/kuuzuki-cli"
            ;;
        "desktop")
            print_info "Starting desktop app..."
            local app_path="$SCRIPT_DIR/packages/desktop/dist-electron/Kuuzuki Desktop.AppImage"
            if [ -f "$app_path" ]; then
                "$app_path"
            else
                print_error "Desktop app not found. Run './run.sh build desktop' first"
                exit 1
            fi
            ;;
        *)
            print_info "Starting kuuzuki (default: TUI mode)..."
            "$SCRIPT_DIR/packages/opencode/kuuzuki-cli"
            ;;
    esac
}

# Function to clean build artifacts
clean() {
    print_header "Cleaning Build Artifacts"

    print_info "Removing build outputs..."
    rm -rf "$SCRIPT_DIR/packages/tui/kuuzuki-tui"
    rm -rf "$SCRIPT_DIR/packages/tui/cmd/opencode/opencode"
    rm -rf "$SCRIPT_DIR/packages/opencode/kuuzuki-cli"
    rm -rf "$SCRIPT_DIR/packages/opencode/binaries"
    rm -rf "$SCRIPT_DIR/packages/desktop/dist"
    rm -rf "$SCRIPT_DIR/packages/desktop/dist-electron"
    rm -rf "$SCRIPT_DIR/packages/desktop/dist-electron"

    print_success "Clean complete"
}

# Function to run tests
run_tests() {
    print_header "Running Tests"

    print_info "Running bun tests..."
    bun test

    print_success "Tests complete"
}

# Function to show help
show_help() {
    echo "Kuuzuki Build & Run Script"
    echo ""
    echo "Usage: ./run.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  install          Install all dependencies"
    echo "  build [target]   Build the project"
    echo "    all            Build everything (default)"
    echo "    tui            Build only the TUI"
    echo "    server         Build only the server/CLI"
    echo "    desktop        Build only the desktop app"
    echo ""
    echo "  dev [mode]       Run in development mode"
    echo "    tui            Run TUI mode (default)"
    echo "    server [port]  Run server mode"
    echo "    desktop        Run desktop app"
    echo ""
    echo "  prod [mode]      Run production build"
    echo "    tui            Run TUI mode (default)"
    echo "    server [port]  Run server mode"
    echo "    desktop        Run desktop app"
    echo ""
    echo "  test             Run tests"
    echo "  clean            Clean build artifacts"
    echo "  check            Check dependencies"
    echo "  help             Show this help message"
    echo ""
    echo "Quick start:"
    echo "  ./run.sh install && ./run.sh build all && ./run.sh dev"
    echo ""
    echo "Examples:"
    echo "  ./run.sh build all        # Build everything"
    echo "  ./run.sh dev              # Run TUI in development"
    echo "  ./run.sh dev server 8080  # Run server on port 8080"
    echo "  ./run.sh dev desktop      # Run desktop app in development"
    echo "  ./run.sh prod desktop     # Run production desktop app"
}

# Main script logic
case "$1" in
    "install")
        check_dependencies
        install_deps
        ;;
    "build")
        check_dependencies
        case "$2" in
            "tui")
                build_tui
                ;;
            "server")
                build_server
                ;;
            "desktop")
                build_desktop
                ;;
            "all"|"")
                build_tui
                build_server
                build_desktop
                ;;
            *)
                print_error "Unknown build target: $2"
                show_help
                exit 1
                ;;
        esac
        ;;
    "dev")
        check_dependencies
        run_dev "$2" "$3"
        ;;
    "prod")
        check_dependencies
        run_prod "$2" "$3"
        ;;
    "test")
        check_dependencies
        run_tests
        ;;
    "clean")
        clean
        ;;
    "check")
        check_dependencies
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    "")
        # Default action: run in dev mode
        check_dependencies
        run_dev
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac