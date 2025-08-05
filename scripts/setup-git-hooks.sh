#!/bin/bash

# Setup script for kuuzuki git hooks
# This script configures git to use the hooks in .githooks/

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Setting up kuuzuki git hooks...${NC}"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not in a git repository!${NC}"
    exit 1
fi

# Configure git to use .githooks directory
echo -e "${BLUE}📁 Configuring git hooks directory...${NC}"
git config core.hooksPath .githooks

# Make sure hooks are executable
echo -e "${BLUE}🔐 Making hooks executable...${NC}"
chmod +x .githooks/*

# Test if hooks are working
echo -e "${BLUE}🧪 Testing hook configuration...${NC}"

if [ -f ".githooks/pre-commit" ]; then
    echo -e "${GREEN}✅ Pre-commit hook installed${NC}"
else
    echo -e "${RED}❌ Pre-commit hook not found${NC}"
fi

if [ -f ".githooks/pre-push" ]; then
    echo -e "${GREEN}✅ Pre-push hook installed${NC}"
else
    echo -e "${RED}❌ Pre-push hook not found${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Git hooks setup complete!${NC}"
echo ""
echo -e "${YELLOW}What the hooks do:${NC}"
echo -e "${YELLOW}📝 Pre-commit:${NC}"
echo "  • Checks lockfile synchronization"
echo "  • Validates TypeScript compilation"
echo "  • Checks Go TUI compilation"
echo "  • Runs critical tests"
echo "  • Checks code quality"
echo ""
echo -e "${YELLOW}🚀 Pre-push:${NC}"
echo "  • Validates kuuzuki packages before version tag pushes"
echo "  • Prevents broken releases"
echo ""
echo -e "${BLUE}💡 To bypass hooks (emergency only):${NC}"
echo "  git commit --no-verify"
echo "  git push --no-verify"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
