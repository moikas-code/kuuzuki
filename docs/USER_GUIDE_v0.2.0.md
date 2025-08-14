# Kuuzuki v0.2.0 User Guide

## Welcome to Beast Mode

Kuuzuki v0.2.0 "Beast Mode" transforms your terminal into a powerful AI-assisted development environment. This guide will help you master all the new features and capabilities.

## 🚀 Quick Start

### Installation

```bash
# Install or upgrade to v0.2.0
npm install -g kuuzuki@0.2.0

# Verify installation
kuuzuki --version
```

### First-Time Setup

```bash
# Set up your API key securely
kuuzuki apikey provider add anthropic sk-ant-api03-...

# Test the setup
kuuzuki apikey provider test

# Start the TUI
kuuzuki tui
```

## 🔥 New Features Overview

### 1. Shell Command Integration (!cmd)

Execute shell commands directly in the TUI:

```bash
# In TUI, type commands with ! prefix
!git status
!npm test
!docker ps
!find . -name "*.js" | head -10
```

**Benefits:**
- Real-time output streaming
- Visual progress indicators
- Integrated with permission system
- Performance metrics

### 2. Enhanced Permission System

Configure fine-grained permissions for different agents and tools:

```json
{
  "permission": {
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "rm *": "deny",
      "*": "ask"
    },
    "agents": {
      "code-reviewer": {
        "bash": "allow",
        "edit": "allow"
      }
    }
  }
}
```

### 3. Secure API Key Management

Store and manage API keys securely:

```bash
# Add keys to secure storage
kuuzuki apikey provider add anthropic sk-ant-...
kuuzuki apikey provider add openai sk-...

# Test key health
kuuzuki apikey provider test anthropic

# List stored keys
kuuzuki apikey provider list
```

### 4. Progressive Streaming

See command output in real-time with performance metrics:

```
$ npm test ●●● Streaming... [15s, 2.1MB]
✓ All tests passed
Command completed in 15.3s (2.1MB transferred, 142KB/s)
```

## 📖 Detailed Feature Guide

### Shell Commands (!cmd)

#### Basic Usage

In the TUI, prefix any command with `!` to execute it:

```bash
!ls -la                    # List files
!pwd                       # Current directory
!git status                # Git status
!npm install               # Install dependencies
!docker build -t app .     # Build Docker image
```

#### Advanced Commands

Complex commands work seamlessly:

```bash
!find . -name "*.py" | xargs grep -l "TODO"
!docker run --rm -v $(pwd):/app node:18 npm test
!grep -r "function" src/ | grep -v test | wc -l
```

#### Real-Time Features

- **Live output**: See results as they're generated
- **Progress tracking**: Monitor execution time and data transfer
- **Visual indicators**: Animated streaming status
- **Memory management**: Automatic truncation for large outputs

#### Permission Integration

Shell commands respect your permission configuration:

```json
{
  "permission": {
    "bash": {
      "git *": "allow",      // Allow all git commands
      "npm test": "allow",   // Allow npm test
      "rm *": "deny",        // Block rm commands
      "*": "ask"             // Ask for everything else
    }
  }
}
```

### Permission System

#### Configuration Levels

1. **Global permissions**: Apply to all tools and agents
2. **Tool-specific permissions**: Configure per tool (bash, edit, etc.)
3. **Agent-specific permissions**: Different permissions per agent
4. **Pattern-based permissions**: Use wildcards for flexible matching

#### Permission Actions

- **`allow`**: Execute without asking
- **`ask`**: Prompt user for confirmation
- **`deny`**: Block execution

#### Examples

**Basic Configuration:**
```json
{
  "permission": {
    "bash": "ask",
    "edit": "allow",
    "write": "ask",
    "read": "allow",
    "webfetch": "ask"
  }
}
```

**Pattern-Based Configuration:**
```json
{
  "permission": {
    "bash": {
      "git status": "allow",
      "git log": "allow",
      "git diff": "allow",
      "git push": "ask",
      "npm test": "allow",
      "npm install": "ask",
      "docker *": "ask",
      "rm *": "deny",
      "sudo *": "deny",
      "*": "ask"
    }
  }
}
```

**Agent-Specific Configuration:**
```json
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
      "deployment": {
        "bash": {
          "docker *": "allow",
          "kubectl *": "allow",
          "git push": "allow",
          "*": "ask"
        },
        "edit": "deny"
      }
    }
  }
}
```

#### Environment Variable Override

Temporarily override permissions:

```bash
export OPENCODE_PERMISSION='{
  "bash": {
    "ls *": "allow",
    "pwd": "allow",
    "*": "ask"
  }
}'
```

### API Key Management

#### Supported Providers

- **Anthropic Claude**: `anthropic`
- **OpenAI**: `openai`
- **OpenRouter**: `openrouter`
- **GitHub Copilot**: `github-copilot`
- **Amazon Bedrock**: `amazon-bedrock`

#### Storage Options

1. **System Keychain** (Recommended):
   - macOS: Keychain Access
   - Linux: Secret Service
   - Windows: Credential Manager

2. **Local File Storage**: Fallback when keychain unavailable

3. **Environment Variables**: For CI/CD and temporary use

#### Commands

```bash
# Add API key
kuuzuki apikey provider add anthropic sk-ant-api03-...

# Add without keychain (file storage only)
kuuzuki apikey provider add openai sk-... --no-keychain

# List stored keys
kuuzuki apikey provider list

# Test key health
kuuzuki apikey provider test anthropic

# Test all keys
kuuzuki apikey provider test

# Remove key
kuuzuki apikey provider remove anthropic
```

#### Health Monitoring

API keys are automatically monitored for:
- **Validity**: Keys are tested against provider endpoints
- **Performance**: Response time tracking
- **Status**: Health status (healthy, degraded, failed)

### TUI Enhancements

#### New Keyboard Shortcuts

- **F2**: Quick model switching
- **`<leader>a`**: Agent selection dialog
- **r**: Rename sessions (in session list)

#### Enhanced Navigation

- **Wrap-around**: Lists wrap from bottom to top and vice versa
- **Visual feedback**: Better highlighting and status indicators
- **Improved dialogs**: Enhanced session and agent selection

#### CLI Arguments

```bash
# Start TUI with specific session
kuuzuki tui --session sess_123

# Start TUI with command to execute
kuuzuki tui --command "!git status"

# Combined usage
kuuzuki tui --session sess_123 --command "analyze this code"
```

## 🛠️ Configuration Guide

### Configuration Files

#### Project Configuration (`.agentrc`)

Place in your project root:

```json
{
  "permission": {
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "yarn *": "allow",
      "bun *": "allow",
      "*": "ask"
    },
    "edit": "allow",
    "write": "ask",
    "read": "allow"
  },
  "model": {
    "default": "anthropic/claude-3-sonnet"
  }
}
```

#### User Configuration (`~/.config/kuuzuki/.agentrc`)

Global settings for all projects:

```json
{
  "permission": {
    "bash": "ask",
    "edit": "ask",
    "write": "ask",
    "read": "allow",
    "webfetch": "ask"
  },
  "model": {
    "default": "anthropic/claude-3-haiku"
  }
}
```

### Environment Variables

#### Essential Variables

```bash
# API keys (if not using secure storage)
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."

# Default model
export KUUZUKI_MODEL="anthropic/claude-3-sonnet"

# Permission override
export OPENCODE_PERMISSION='{"bash": "allow", "edit": "ask"}'
```

#### Development Variables

```bash
# Enable debug logging
export DEBUG="permission,agent,tool"

# Development mode
export KUUZUKI_DEV_MODE="true"

# Custom directories
export KUUZUKI_CONFIG_DIR="$HOME/.config/kuuzuki"
export KUUZUKI_DATA_DIR="$HOME/.local/share/kuuzuki"
```

#### Production Variables

```bash
# Restrictive permissions for production
export OPENCODE_PERMISSION='{
  "bash": {
    "git status": "allow",
    "git log": "allow",
    "*": "deny"
  },
  "edit": "deny",
  "write": "deny",
  "read": "allow",
  "webfetch": "deny"
}'

# Production logging
export LOG_LEVEL="WARN"
```

### Priority Order

Configuration is resolved in this order (highest to lowest):

1. **Command-line arguments**: `--model`, `--log-level`
2. **Environment variables**: `OPENCODE_PERMISSION`, `KUUZUKI_MODEL`
3. **Project `.agentrc`**: In current directory
4. **User `.agentrc`**: In `~/.config/kuuzuki/`
5. **System defaults**

## 🎯 Use Cases and Workflows

### Development Workflow

```bash
# Start TUI
kuuzuki tui

# Check project status
!git status
!npm test

# Make changes with AI assistance
"Help me refactor this function to use async/await"

# Build and test
!npm run build
!npm run test:coverage

# Deploy
!docker build -t myapp .
!kubectl apply -f deployment.yaml
```

### Code Review Workflow

```json
// .agentrc for code review
{
  "permission": {
    "bash": {
      "git *": "allow",
      "npm test": "allow",
      "npm run lint": "allow",
      "*": "deny"
    },
    "edit": "allow",
    "read": "allow",
    "write": "deny"
  },
  "agents": {
    "code-reviewer": {
      "bash": "allow",
      "edit": "allow"
    }
  }
}
```

### System Administration

```bash
# Monitor system
!ps aux | grep node
!df -h
!free -m
!netstat -tulpn | grep :3000

# Log analysis
!tail -f /var/log/nginx/access.log
!grep ERROR /var/log/app.log | tail -20

# Service management
!systemctl status nginx
!docker ps
!kubectl get pods
```

### CI/CD Integration

```bash
# Environment setup for CI
export KUUZUKI_MODEL="anthropic/claude-3-haiku"  # Faster/cheaper
export OPENCODE_PERMISSION='{
  "bash": {
    "npm test": "allow",
    "npm run build": "allow",
    "git *": "allow",
    "*": "deny"
  },
  "read": "allow",
  "write": "deny",
  "edit": "deny"
}'

# Run tests with AI analysis
kuuzuki run "Analyze test failures and suggest fixes"
```

## 🔧 Troubleshooting

### Common Issues

#### Shell Commands Not Working

**Problem**: `!` commands don't execute

**Solutions**:
1. Check permissions:
   ```bash
   kuuzuki config show permission.bash
   ```

2. Enable bash permissions:
   ```bash
   export OPENCODE_PERMISSION='{"bash": "allow"}'
   ```

3. Check debug logs:
   ```bash
   DEBUG=bash kuuzuki tui
   ```

#### API Key Issues

**Problem**: API key not working

**Solutions**:
1. Test key health:
   ```bash
   kuuzuki apikey provider test anthropic
   ```

2. Re-add the key:
   ```bash
   kuuzuki apikey provider remove anthropic
   kuuzuki apikey provider add anthropic sk-ant-...
   ```

3. Check environment variables:
   ```bash
   echo $ANTHROPIC_API_KEY
   ```

#### Permission Denied Errors

**Problem**: Actions blocked by permissions

**Solutions**:
1. Check current permissions:
   ```bash
   kuuzuki config show permission
   ```

2. Temporarily allow actions:
   ```bash
   export OPENCODE_PERMISSION='{"bash": "allow", "edit": "allow"}'
   ```

3. Update `.agentrc`:
   ```json
   {
     "permission": {
       "bash": "ask",
       "edit": "allow"
     }
   }
   ```

#### Performance Issues

**Problem**: Slow command execution

**Solutions**:
1. Check system resources:
   ```bash
   !top
   !free -m
   !df -h
   ```

2. Use more specific commands:
   ```bash
   # Instead of: !find / -name "*.log"
   !find /var/log -name "*.log" | head -20
   ```

3. Enable performance monitoring:
   ```bash
   DEBUG=performance kuuzuki tui
   ```

### Debug Mode

Enable comprehensive debugging:

```bash
# Debug specific modules
DEBUG=permission,agent,tool kuuzuki tui

# Debug everything
DEBUG=* kuuzuki tui

# Debug with log file
DEBUG=* kuuzuki tui 2> debug.log
```

### Configuration Validation

```bash
# Validate .agentrc
jq . .agentrc

# Validate environment variable
echo $OPENCODE_PERMISSION | jq .

# Check configuration resolution
kuuzuki config show
```

## 🚀 Advanced Tips

### Power User Shortcuts

1. **Quick model switching**: Use F2 for instant model changes
2. **Agent switching**: Use `<leader>a` for quick agent selection
3. **Session management**: Use 'r' to rename sessions inline
4. **Permission overrides**: Use environment variables for temporary changes

### Automation Scripts

#### Development Setup Script
```bash
#!/bin/bash
# dev-setup.sh

# Set development permissions
export OPENCODE_PERMISSION='{
  "bash": "allow",
  "edit": "allow",
  "write": "ask",
  "read": "allow",
  "webfetch": "ask"
}'

# Enable debug mode
export DEBUG="permission,agent"
export KUUZUKI_DEV_MODE="true"

# Start TUI
kuuzuki tui
```

#### Production Deployment Script
```bash
#!/bin/bash
# deploy.sh

# Set restrictive permissions
export OPENCODE_PERMISSION='{
  "bash": {
    "git status": "allow",
    "git log": "allow",
    "docker build": "ask",
    "kubectl apply": "ask",
    "*": "deny"
  },
  "edit": "deny",
  "write": "deny",
  "read": "allow"
}'

# Use faster model for deployment
export KUUZUKI_MODEL="anthropic/claude-3-haiku"

# Run deployment analysis
kuuzuki run "Analyze deployment readiness and suggest improvements"
```

### Integration Examples

#### Git Hooks Integration
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Use kuuzuki for commit analysis
kuuzuki run "Analyze staged changes and suggest improvements" \
  --model anthropic/claude-3-haiku
```

#### Docker Integration
```dockerfile
FROM node:18

# Install kuuzuki
RUN npm install -g kuuzuki@0.2.0

# Set secure permissions
ENV OPENCODE_PERMISSION='{"bash":{"npm *":"allow","node *":"allow","*":"deny"},"read":"allow","write":"ask","edit":"ask"}'

# Copy application
COPY . /app
WORKDIR /app

# Use kuuzuki for analysis
RUN kuuzuki run "Analyze Dockerfile and suggest optimizations"
```

## 📚 Learning Resources

### Documentation
- **API Reference**: Complete API documentation
- **Configuration Guide**: Detailed configuration options
- **Permission System**: In-depth permission configuration
- **Environment Variables**: Complete variable reference

### Community
- **GitHub Discussions**: Ask questions and share tips
- **Discord**: Real-time community support
- **Issues**: Report bugs and request features

### Examples
- **Sample Configurations**: Ready-to-use configuration examples
- **Workflow Templates**: Common development workflows
- **Integration Examples**: CI/CD and tool integrations

---

**Congratulations!** You're now ready to unleash the full power of Kuuzuki v0.2.0 "Beast Mode". Start with the basic features and gradually explore the advanced capabilities as you become more comfortable with the system.