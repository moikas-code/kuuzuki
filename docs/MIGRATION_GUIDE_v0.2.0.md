# Migration Guide: Kuuzuki v0.1.x to v0.2.0

## Overview

Kuuzuki v0.2.0 "Beast Mode" introduces significant new features while maintaining full backward compatibility. This guide helps you migrate from v0.1.x versions and take advantage of the new capabilities.

## 🔄 Quick Migration

### For Most Users (No Changes Required)

If you're using basic kuuzuki functionality, **no changes are required**. Your existing configuration will continue to work exactly as before.

```bash
# Simply upgrade to the latest version
npm install -g kuuzuki@0.2.0

# Your existing setup continues to work
kuuzuki tui
```

### For Advanced Users (Optional Enhancements)

Take advantage of new features by updating your configuration and workflow.

## 📋 What's New and How to Use It

### 1. Shell Command Integration (!cmd)

**New Feature**: Execute shell commands directly in TUI with `!` prefix.

**No migration needed** - this is a new feature that works immediately.

**Usage**:
```bash
# In TUI, type commands with ! prefix
!git status
!npm test
!docker ps
```

**Benefits**:
- Real-time output streaming
- Visual progress indicators
- Integrated with permission system

### 2. Enhanced Permission System

**Backward Compatible**: Your existing permissions continue to work.

**Optional Enhancement**: Upgrade to the new object format for more control.

#### Current Array Format (Still Supported)
```json
{
  "permission": ["git *", "npm *", "ls *"]
}
```

#### New Object Format (Recommended)
```json
{
  "permission": {
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "ls *": "allow",
      "*": "ask"
    },
    "edit": "allow",
    "write": "ask",
    "read": "allow",
    "webfetch": "ask"
  }
}
```

#### Agent-Level Permissions (New)
```json
{
  "permission": {
    "bash": "ask",
    "edit": "allow",
    "agents": {
      "code-reviewer": {
        "bash": "allow",
        "edit": "allow"
      },
      "documentation": {
        "bash": "deny",
        "edit": "allow"
      }
    }
  }
}
```

### 3. API Key Management System

**New Feature**: Secure API key storage and management.

**Migration**: Move from environment variables to secure storage (optional but recommended).

#### Before (Environment Variables)
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
export OPENAI_API_KEY="sk-..."
```

#### After (Secure Storage)
```bash
# Store keys securely
kuuzuki apikey provider add anthropic sk-ant-api03-...
kuuzuki apikey provider add openai sk-...

# Test keys
kuuzuki apikey provider test

# List stored keys
kuuzuki apikey provider list
```

**Benefits**:
- System keychain integration
- Health checking
- Multiple provider support
- Secure storage

### 4. Environment Variable Enhancements

**New Variables**: Additional configuration options available.

**Existing variables continue to work** - these are additions.

#### New Environment Variables
```bash
# Permission system override
export OPENCODE_PERMISSION='{
  "bash": "ask",
  "edit": "allow"
}'

# Configuration directories
export KUUZUKI_CONFIG_DIR="$HOME/.config/kuuzuki"
export KUUZUKI_DATA_DIR="$HOME/.local/share/kuuzuki"

# Development settings
export DEBUG="permission,agent"
export KUUZUKI_DEV_MODE="true"
```

## 🔧 Step-by-Step Migration

### Step 1: Upgrade Kuuzuki

```bash
# Check current version
kuuzuki --version

# Upgrade to v0.2.0
npm install -g kuuzuki@0.2.0

# Verify upgrade
kuuzuki --version
# Should show 0.2.0 or higher
```

### Step 2: Test Basic Functionality

```bash
# Test TUI (should work exactly as before)
kuuzuki tui

# Test CLI (should work exactly as before)
kuuzuki run "Hello, world!"
```

### Step 3: Migrate API Keys (Recommended)

```bash
# If you have ANTHROPIC_API_KEY set
kuuzuki apikey provider add anthropic $ANTHROPIC_API_KEY

# If you have OPENAI_API_KEY set
kuuzuki apikey provider add openai $OPENAI_API_KEY

# Test the migration
kuuzuki apikey provider test

# Optional: Remove from environment after successful migration
# unset ANTHROPIC_API_KEY
# unset OPENAI_API_KEY
```

### Step 4: Enhance Permissions (Optional)

#### If you have simple permissions:
```json
// Current .agentrc
{
  "permission": ["git *", "npm *"]
}
```

#### Consider upgrading to:
```json
// Enhanced .agentrc
{
  "permission": {
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "ls *": "allow",
      "pwd": "allow",
      "*": "ask"
    },
    "edit": "allow",
    "write": "ask",
    "read": "allow",
    "webfetch": "ask"
  }
}
```

### Step 5: Try New Features

#### Shell Commands
```bash
# Start TUI
kuuzuki tui

# Try shell commands (type in TUI)
!git status
!ls -la
!npm test
```

#### Agent-Level Permissions
```json
// Add to .agentrc
{
  "permission": {
    "bash": "ask",
    "agents": {
      "code-reviewer": {
        "bash": "allow",
        "edit": "allow"
      }
    }
  }
}
```

## 🔍 Configuration Migration Examples

### Basic Development Setup

#### Before (v0.1.x)
```bash
# .env or shell profile
export ANTHROPIC_API_KEY="sk-ant-..."
```

```json
// .agentrc
{
  "permission": ["git *", "npm *", "ls *"]
}
```

#### After (v0.2.0)
```bash
# One-time setup
kuuzuki apikey provider add anthropic sk-ant-...
```

```json
// .agentrc (enhanced)
{
  "permission": {
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "ls *": "allow",
      "pwd": "allow",
      "*": "ask"
    },
    "edit": "allow",
    "write": "ask",
    "read": "allow",
    "webfetch": "ask"
  }
}
```

### Team/Production Setup

#### Before (v0.1.x)
```bash
# Environment variables
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENCODE_PERMISSION='["git status", "git log", "ls *"]'
```

#### After (v0.2.0)
```bash
# Secure API key storage
kuuzuki apikey provider add anthropic sk-ant-...

# Enhanced permission configuration
export OPENCODE_PERMISSION='{
  "bash": {
    "git status": "allow",
    "git log": "allow",
    "git diff": "allow",
    "ls *": "allow",
    "pwd": "allow",
    "*": "deny"
  },
  "edit": "deny",
  "write": "deny",
  "read": "allow",
  "webfetch": "deny"
}'
```

### Multi-Agent Setup (New)

```json
// .agentrc (new capability)
{
  "permission": {
    "bash": "ask",
    "edit": "ask",
    "agents": {
      "code-reviewer": {
        "bash": {
          "git *": "allow",
          "npm test": "allow",
          "*": "deny"
        },
        "edit": "allow",
        "read": "allow"
      },
      "documentation": {
        "bash": "deny",
        "edit": "allow",
        "write": "allow",
        "read": "allow"
      },
      "deployment": {
        "bash": {
          "docker *": "allow",
          "kubectl *": "allow",
          "*": "ask"
        },
        "edit": "deny",
        "read": "allow"
      }
    }
  }
}
```

## 🚨 Breaking Changes

**Good News**: There are **NO breaking changes** in v0.2.0!

All existing configurations, commands, and workflows continue to work exactly as before.

### Deprecation Notices

- **Array-format permissions**: Still supported but deprecated
  - Current: `"permission": ["git *", "npm *"]`
  - Recommended: `"permission": {"bash": {"git *": "allow", "npm *": "allow"}}`

- **Environment-only API keys**: Still supported but secure storage is recommended
  - Current: `export ANTHROPIC_API_KEY="..."`
  - Recommended: `kuuzuki apikey provider add anthropic ...`

## 🔧 Troubleshooting Migration

### Common Issues and Solutions

#### 1. "Command not found" after upgrade

```bash
# Check if kuuzuki is properly installed
which kuuzuki
npm list -g kuuzuki

# Reinstall if needed
npm uninstall -g kuuzuki
npm install -g kuuzuki@0.2.0
```

#### 2. API key not working after migration

```bash
# Check if key was stored correctly
kuuzuki apikey provider list

# Test the key
kuuzuki apikey provider test anthropic

# If issues, re-add the key
kuuzuki apikey provider remove anthropic
kuuzuki apikey provider add anthropic sk-ant-...
```

#### 3. Permissions not working as expected

```bash
# Check current permission configuration
kuuzuki config show permission

# Test with debug logging
DEBUG=permission kuuzuki tui

# Validate JSON format if using environment variable
echo $OPENCODE_PERMISSION | jq .
```

#### 4. Shell commands (!cmd) not working

```bash
# Ensure you're using the TUI
kuuzuki tui

# Check permissions for bash tool
kuuzuki config show permission.bash

# Try with explicit permission
export OPENCODE_PERMISSION='{"bash": "allow"}'
kuuzuki tui
```

### Validation Scripts

#### Check Migration Status
```bash
#!/bin/bash
echo "=== Kuuzuki v0.2.0 Migration Check ==="

# Check version
echo "Version: $(kuuzuki --version)"

# Check API keys
echo "API Keys:"
kuuzuki apikey provider list

# Check permissions
echo "Permissions:"
kuuzuki config show permission

# Test basic functionality
echo "Testing basic functionality..."
kuuzuki run "test" --model anthropic/claude-3-haiku

echo "=== Migration Check Complete ==="
```

#### Validate Configuration
```bash
#!/bin/bash
echo "=== Configuration Validation ==="

# Check if .agentrc exists
if [ -f .agentrc ]; then
  echo "✅ .agentrc found"
  
  # Validate JSON
  if jq . .agentrc > /dev/null 2>&1; then
    echo "✅ .agentrc is valid JSON"
  else
    echo "❌ .agentrc has invalid JSON"
  fi
else
  echo "ℹ️  No .agentrc found (using defaults)"
fi

# Check environment variables
if [ -n "$OPENCODE_PERMISSION" ]; then
  if echo "$OPENCODE_PERMISSION" | jq . > /dev/null 2>&1; then
    echo "✅ OPENCODE_PERMISSION is valid JSON"
  else
    echo "❌ OPENCODE_PERMISSION has invalid JSON"
  fi
fi

echo "=== Validation Complete ==="
```

## 📚 Next Steps

### Explore New Features

1. **Try shell commands**: Use `!` prefix in TUI for direct shell execution
2. **Set up secure API keys**: Migrate to the new API key management system
3. **Configure agent permissions**: Set up different permissions for different agents
4. **Explore environment variables**: Use new configuration options

### Best Practices

1. **Gradual adoption**: Start with basic features and gradually adopt advanced ones
2. **Test in development**: Try new features in development before production
3. **Regular backups**: Keep backups of your configuration files
4. **Stay updated**: Follow the changelog for future updates

### Getting Help

- **Documentation**: [kuuzuki.com/docs](https://kuuzuki.com/docs)
- **Issues**: [GitHub Issues](https://github.com/moikas-code/kuuzuki/issues)
- **Discussions**: [GitHub Discussions](https://github.com/moikas-code/kuuzuki/discussions)
- **Discord**: [Community Discord](https://discord.gg/kuuzuki)

---

**Welcome to Kuuzuki v0.2.0 "Beast Mode"!** 🚀

Your existing setup continues to work, and you now have access to powerful new features when you're ready to use them.