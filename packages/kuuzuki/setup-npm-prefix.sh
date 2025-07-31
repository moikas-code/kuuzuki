#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 NPM Prefix Setup Script${NC}"
echo "=========================="

# Check if we're in a workspace environment
if [ -f "../../package.json" ] && grep -q '"workspaces"' "../../package.json"; then
    echo -e "${YELLOW}⚠️  Detected npm workspace environment${NC}"
    echo "Running npm config commands from workspace root..."
    
    # Change to workspace root
    cd ../..
fi

# Check current prefix
CURRENT_PREFIX=$(npm config get prefix)
echo -e "${BLUE}Current npm prefix:${NC} $CURRENT_PREFIX"

# Check if it's a system directory
if [[ "$CURRENT_PREFIX" == "/usr" ]] || [[ "$CURRENT_PREFIX" == "/usr/local" ]]; then
    echo -e "${YELLOW}⚠️  npm is configured to use system directories${NC}"
    echo "This requires sudo for global installs, which is not recommended."
    echo ""
    echo -e "${GREEN}Setting up user-specific npm directory...${NC}"
    
    # Set new prefix
    NPM_PREFIX="$HOME/.npm-global"
    npm config set prefix "$NPM_PREFIX"
    
    # Create directory if it doesn't exist
    mkdir -p "$NPM_PREFIX"
    
    # Detect shell
    SHELL_RC=""
    if [ -n "$ZSH_VERSION" ]; then
        SHELL_RC="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        SHELL_RC="$HOME/.bashrc"
    else
        SHELL_RC="$HOME/.profile"
    fi
    
    # Check if PATH already includes npm prefix
    if ! grep -q "$NPM_PREFIX/bin" "$SHELL_RC" 2>/dev/null; then
        echo ""
        echo -e "${GREEN}Adding npm prefix to PATH in $SHELL_RC${NC}"
        echo "" >> "$SHELL_RC"
        echo "# npm global directory (added by kuuzuki setup)" >> "$SHELL_RC"
        echo "export PATH=\"$NPM_PREFIX/bin:\$PATH\"" >> "$SHELL_RC"
        
        echo -e "${YELLOW}⚠️  IMPORTANT: Run this command to update your current session:${NC}"
        echo -e "${BLUE}export PATH=\"$NPM_PREFIX/bin:\$PATH\"${NC}"
    else
        echo -e "${GREEN}✓ PATH already includes npm prefix${NC}"
        # Still export for current session
        export PATH="$NPM_PREFIX/bin:$PATH"
    fi
    
    echo ""
    echo -e "${GREEN}✅ npm prefix configured successfully!${NC}"
    echo -e "New prefix: ${BLUE}$NPM_PREFIX${NC}"
    
else
    echo -e "${GREEN}✓ npm prefix is already set to a user directory${NC}"
    
    # Check if it's in PATH
    if [[ ":$PATH:" != *":$CURRENT_PREFIX/bin:"* ]]; then
        echo -e "${YELLOW}⚠️  But $CURRENT_PREFIX/bin is not in PATH${NC}"
        echo -e "Add this to your shell config: ${BLUE}export PATH=\"$CURRENT_PREFIX/bin:\$PATH\"${NC}"
    fi
fi

echo ""
echo -e "${GREEN}You can now install packages globally without sudo:${NC}"
echo -e "${BLUE}npm i -g ./dist/npm/kuuzuki/*.tgz ./dist/npm/kuuzuki-linux-x64/*.tgz${NC}"