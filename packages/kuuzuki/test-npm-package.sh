#\!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 Kuuzuki NPM Package Test Script${NC}"
echo "===================================="

# Parse arguments
SKIP_BUILD=false
KEEP_INSTALLED=false
TEST_GLOBAL=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --keep-installed)
      KEEP_INSTALLED=true
      shift
      ;;
    --global)
      TEST_GLOBAL=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--skip-build] [--keep-installed] [--global]"
      exit 1
      ;;
  esac
done

# Global variables
INSTALL_DIR=""
TEST_DIR=""

# Function to cleanup
cleanup() {
  if [ "$KEEP_INSTALLED" = false ] && [ "$TEST_GLOBAL" = true ]; then
    echo -e "\n${YELLOW}🧹 Cleaning up global installation...${NC}"
    npm uninstall -g kuuzuki kuuzuki-linux-x64 2>/dev/null || true
  fi
  
  if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
  fi
  
  if [ -d "$TEST_DIR" ]; then
    echo -e "${YELLOW}🧹 Cleaning up test directory...${NC}"
    rm -rf "$TEST_DIR"
  fi
}

# Set up cleanup on exit
trap cleanup EXIT

# Build packages if not skipping
if [ "$SKIP_BUILD" = false ]; then
  echo -e "\n${GREEN}📦 Building packages...${NC}"
  bun scripts/build-npm-packages.ts --current-platform --pack
else
  echo -e "\n${YELLOW}⏭️  Skipping build (using existing packages)${NC}"
fi

# Check if packages exist
if [ \! -f "dist/npm/kuuzuki/kuuzuki-0.1.9.tgz" ]; then
  echo -e "${RED}❌ Main package not found\! Run without --skip-build${NC}"
  exit 1
fi

# Get current platform
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$PLATFORM" in
  darwin) PLATFORM="darwin" ;;
  linux) PLATFORM="linux" ;;
  mingw*|cygwin*|msys*) PLATFORM="windows" ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac

PLATFORM_PKG="kuuzuki-${PLATFORM}-${ARCH}"

if [ \! -f "dist/npm/${PLATFORM_PKG}/${PLATFORM_PKG}-0.1.9.tgz" ]; then
  echo -e "${RED}❌ Platform package not found: ${PLATFORM_PKG}${NC}"
  exit 1
fi

# Test installation
if [ "$TEST_GLOBAL" = true ]; then
  echo -e "\n${GREEN}📥 Installing packages globally...${NC}"
  
  # Move to a non-workspace directory to avoid npm workspace issues
  INSTALL_DIR=$(mktemp -d)
  cp "$PWD/dist/npm/kuuzuki/kuuzuki-0.1.9.tgz" "$INSTALL_DIR/"
  cp "$PWD/dist/npm/${PLATFORM_PKG}/${PLATFORM_PKG}-0.1.9.tgz" "$INSTALL_DIR/"
  OLDPWD="$PWD"
  cd "$INSTALL_DIR"
  
  # Check if we need to set npm prefix
  NPM_PREFIX=$(npm config get prefix)
  if [[ "$NPM_PREFIX" == "/usr" ]] || [[ "$NPM_PREFIX" == "/usr/local" ]]; then
    echo -e "${YELLOW}⚠️  npm prefix is system directory${NC}"
    echo -e "${YELLOW}Setting up temporary user directory for this test...${NC}"
    
    # Use temporary npm prefix for this test
    TEMP_NPM_PREFIX="$HOME/.npm-global"
    npm config set prefix "$TEMP_NPM_PREFIX"
    export PATH="$TEMP_NPM_PREFIX/bin:$PATH"
    RESTORE_PREFIX=true
    
    echo -e "${YELLOW}💡 To fix this permanently, run: ${GREEN}./setup-npm-prefix.sh${NC}"
  fi
  
  # Install from tarballs
  npm install -g ./kuuzuki-0.1.9.tgz ./${PLATFORM_PKG}-0.1.9.tgz
  
  echo -e "\n${GREEN}🧪 Testing global installation...${NC}"
  
  # Test version
  echo -e "${YELLOW}Testing: kuuzuki --version${NC}"
  kuuzuki --version
  
  # Test help
  echo -e "\n${YELLOW}Testing: kuuzuki --help${NC}"
  kuuzuki --help | head -10
  
  echo -e "\n${GREEN}✅ Global installation test passed\!${NC}"
  
  if [ "$KEEP_INSTALLED" = true ]; then
    echo -e "${YELLOW}📌 Keeping packages installed (use 'npm uninstall -g kuuzuki ${PLATFORM_PKG}' to remove)${NC}"
  fi
  
  # Restore npm prefix if we changed it
  if [ "$RESTORE_PREFIX" = true ]; then
    npm config set prefix "$NPM_PREFIX"
  fi
  
  cd "$OLDPWD"
  
else
  # Local directory test
  TEST_DIR=$(mktemp -d)
  echo -e "\n${GREEN}📁 Creating test directory: $TEST_DIR${NC}"
  cd "$TEST_DIR"
  
  echo -e "\n${GREEN}📥 Installing packages locally...${NC}"
  npm init -y >/dev/null 2>&1
  npm install \
    "$OLDPWD/dist/npm/kuuzuki/kuuzuki-0.1.9.tgz" \
    "$OLDPWD/dist/npm/${PLATFORM_PKG}/${PLATFORM_PKG}-0.1.9.tgz"
  
  echo -e "\n${GREEN}🧪 Testing local installation...${NC}"
  
  # Test with npx
  echo -e "${YELLOW}Testing: npx kuuzuki --version${NC}"
  npx kuuzuki --version
  
  # Test with node_modules
  echo -e "\n${YELLOW}Testing: ./node_modules/.bin/kuuzuki --version${NC}"
  ./node_modules/.bin/kuuzuki --version
  
  echo -e "\n${GREEN}✅ Local installation test passed\!${NC}"
fi

# Test the binary directly
echo -e "\n${GREEN}🧪 Testing binary directly...${NC}"
BINARY_PATH="$OLDPWD/dist/binaries/${PLATFORM}-${ARCH}/kuuzuki"
if [ -f "$BINARY_PATH" ]; then
  echo -e "${YELLOW}Testing: $BINARY_PATH --version${NC}"
  "$BINARY_PATH" --version
else
  echo -e "${YELLOW}⚠️  Binary not found at $BINARY_PATH${NC}"
fi

echo -e "\n${GREEN}🎉 All tests passed\!${NC}"
echo -e "\n${YELLOW}Quick commands for manual testing:${NC}"
echo "  # Install globally:"
echo "  npm i -g ./dist/npm/kuuzuki/*.tgz ./dist/npm/${PLATFORM_PKG}/*.tgz"
echo ""
echo "  # Test TUI:"
echo "  kuuzuki"
echo ""
echo "  # Uninstall:"
echo "  npm uninstall -g kuuzuki ${PLATFORM_PKG}"
