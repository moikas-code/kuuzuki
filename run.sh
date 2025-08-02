#\!/bin/bash

set -e

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${YELLOW}=== $1 ===${NC}\n"
}

# Function to check dependencies
check_dependencies() {
    print_header "Checking Dependencies"
    local missing_deps=()
    
    # Check for required tools
    if \! command -v bun &> /dev/null; then
        missing_deps+=("bun")
    fi
    
    if \! command -v go &> /dev/null; then
        missing_deps+=("go")
    fi
    
    if \! command -v bunx &> /dev/null; then
        missing_deps+=("bunx")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        echo "Please install the missing dependencies before continuing."
        exit 1
    fi
    
    print_success "All dependencies are installed"
}

# Function to build TUI
build_tui() {
    print_header "Building TUI"
    cd "$SCRIPT_DIR/packages/tui"
    
    print_info "Building kuuzuki TUI..."
    
    # Get version from package.json
    VERSION=$(jq -r .version ../kuuzuki/package.json)
    print_info "Injecting version: $VERSION"
    
    # Build with version injection using ldflags
    go build -ldflags "-X main.Version=$VERSION" -o kuuzuki-tui ./cmd/kuuzuki
    
    print_success "TUI built successfully with version $VERSION"
    cd "$SCRIPT_DIR"
}

# Function to build server
build_server() {
    print_header "Building Server/CLI"
    cd "$SCRIPT_DIR/packages/kuuzuki"
    
    print_info "Building kuuzuki CLI..."
    
    # Get version from package.json
    VERSION=$(jq -r .version package.json)
    
    # Use bun's bundler to create a self-contained binary
    bun build src/index.ts \
        --compile \
        --target=bun \
        --outfile=bin/kuuzuki \
        --external keytar \
        --define KUUZUKI_VERSION="'$VERSION'"
    
    chmod +x bin/kuuzuki
    print_success "Server/CLI built successfully"
    cd "$SCRIPT_DIR"
}

# Function to run in development mode
run_dev() {
    print_header "Running in Development Mode"
    
    case "$1" in
        "server")
            print_info "Starting kuuzuki server..."
            cd "$SCRIPT_DIR/packages/kuuzuki"
            bun run src/index.ts serve --port ${2:-4096}
            ;;
        "tui")
            print_info "Starting kuuzuki TUI..."
            cd "$SCRIPT_DIR/packages/kuuzuki"
            bun run src/index.ts tui
            ;;
        *)
            print_info "Starting kuuzuki (default: TUI mode)..."
            cd "$SCRIPT_DIR/packages/kuuzuki"
            bun run src/index.ts tui
            ;;
    esac
}

# Function to run production build
run_prod() {
    print_header "Running Production Build"
    
    case "$1" in
        "server")
            print_info "Starting kuuzuki server..."
            "$SCRIPT_DIR/packages/kuuzuki/bin/kuuzuki" serve --port ${2:-4096}
            ;;
        "tui")
            print_info "Starting kuuzuki TUI..."
            "$SCRIPT_DIR/packages/kuuzuki/bin/kuuzuki"
            ;;
        *)
            print_info "Starting kuuzuki (default: TUI mode)..."
            "$SCRIPT_DIR/packages/kuuzuki/bin/kuuzuki"
            ;;
    esac
}

# Function to run tests
run_tests() {
    print_header "Running Tests"
    
    print_info "Running Kuuzuki tests..."
    cd "$SCRIPT_DIR/packages/kuuzuki"
    bun test
    
    print_success "All tests passed"
}

# Function to clean build artifacts
clean() {
    print_header "Cleaning Build Artifacts"
    
    rm -rf "$SCRIPT_DIR/packages/tui/kuuzuki-tui"
    rm -rf "$SCRIPT_DIR/packages/kuuzuki/bin/kuuzuki"
    rm -rf "$SCRIPT_DIR/packages/kuuzuki/binaries"
    
    print_success "Clean complete"
}

# Function to display help
show_help() {
    echo "Kuuzuki Build & Run Script"
    echo ""
    echo "Usage: ./run.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  build [target]   Build kuuzuki"
    echo "    tui            Build only the TUI"
    echo "    server         Build only the server/CLI"
    echo ""
    echo "  dev [mode]       Run in development mode"
    echo "    tui            Run TUI mode (default)"
    echo "    server [port]  Run server mode"
    echo ""
    echo "  prod [mode]      Run production build"
    echo "    tui            Run TUI mode (default)"
    echo "    server [port]  Run server mode"
    echo ""
    echo "  test             Run tests"
    echo "  clean            Clean build artifacts"
    echo "  check            Check dependencies"
    echo "  help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./run.sh build            # Build everything"
    echo "  ./run.sh build tui        # Build only TUI"
    echo "  ./run.sh dev              # Run TUI in development"
    echo "  ./run.sh dev server 8080  # Run server on port 8080"
}

# Main script logic
case "$1" in
    "build")
        check_dependencies
        case "$2" in
            "tui")
                build_tui
                ;;
            "server")
                build_server
                ;;
            "all"|"")
                build_tui
                build_server
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
        # Default to dev mode
        check_dependencies
        run_dev
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
