# Environment Variables Reference

Complete reference for all environment variables used by kuuzuki.

## Table of Contents

- [Required Variables](#required-variables)
- [Optional Configuration](#optional-configuration)
- [Permission System](#permission-system)
- [Model Configuration](#model-configuration)
- [Development & Debugging](#development--debugging)
- [System Configuration](#system-configuration)
- [Priority and Precedence](#priority-and-precedence)

## Required Variables

### `ANTHROPIC_API_KEY`
**Required for Claude models**

Your Anthropic API key for accessing Claude models.

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

**How to get:**
1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy and set the key

**Security note:** Keep this key secure and never commit it to version control.

### `OPENAI_API_KEY`
**Required for OpenAI models**

Your OpenAI API key for accessing GPT models.

```bash
export OPENAI_API_KEY="sk-..."
```

## Optional Configuration

### `KUUZUKI_MODEL`
**Default AI model**

Specify the default AI model to use across all sessions.

```bash
export KUUZUKI_MODEL="anthropic/claude-3-sonnet"
export KUUZUKI_MODEL="openai/gpt-4"
```

**Available models:** Use `kuuzuki models` to see all options.

### `KUUZUKI_CONFIG_DIR`
**Custom configuration directory**

Override the default configuration directory location.

```bash
export KUUZUKI_CONFIG_DIR="$HOME/.config/kuuzuki"
export KUUZUKI_CONFIG_DIR="/opt/kuuzuki/config"
```

**Default locations:**
- Linux: `~/.config/kuuzuki/`
- macOS: `~/.config/kuuzuki/`
- Windows: `%APPDATA%\kuuzuki\`

### `KUUZUKI_DATA_DIR`
**Custom data directory**

Override the default data directory location.

```bash
export KUUZUKI_DATA_DIR="$HOME/.local/share/kuuzuki"
export KUUZUKI_DATA_DIR="/var/lib/kuuzuki"
```

### `KUUZUKI_CACHE_DIR`
**Custom cache directory**

Override the default cache directory location.

```bash
export KUUZUKI_CACHE_DIR="$HOME/.cache/kuuzuki"
export KUUZUKI_CACHE_DIR="/tmp/kuuzuki-cache"
```

## Permission System

### `OPENCODE_PERMISSION`
**JSON permission configuration**

Override `.agentrc` permission settings with environment variable.

**Basic format:**
```bash
export OPENCODE_PERMISSION='{
  "bash": "ask",
  "edit": "allow",
  "write": "ask",
  "read": "allow",
  "webfetch": "ask"
}'
```

**Pattern-based permissions:**
```bash
export OPENCODE_PERMISSION='{
  "bash": {
    "git *": "allow",
    "npm *": "allow",
    "rm *": "deny",
    "*": "ask"
  },
  "edit": "allow"
}'
```

**Agent-specific permissions:**
```bash
export OPENCODE_PERMISSION='{
  "bash": "ask",
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
}'
```

**Legacy array format:**
```bash
export OPENCODE_PERMISSION='["git *", "npm *", "ls *"]'
```

### Permission Levels

- **`allow`**: Execute without asking
- **`ask`**: Prompt user for confirmation  
- **`deny`**: Block execution

### Supported Tools

- **`bash`**: Shell command execution
- **`edit`**: File editing operations
- **`write`**: File creation/writing
- **`read`**: File reading operations
- **`webfetch`**: HTTP requests and web content fetching

## Model Configuration

### `KUUZUKI_TEMPERATURE`
**Model temperature setting**

Control response randomness (0.0 = deterministic, 1.0 = creative).

```bash
export KUUZUKI_TEMPERATURE="0.7"
export KUUZUKI_TEMPERATURE="0.1"  # More focused
export KUUZUKI_TEMPERATURE="0.9"  # More creative
```

### `KUUZUKI_MAX_TOKENS`
**Maximum response tokens**

Limit the length of AI responses.

```bash
export KUUZUKI_MAX_TOKENS="4096"
export KUUZUKI_MAX_TOKENS="8192"
```

### `KUUZUKI_TOP_P`
**Nucleus sampling parameter**

Control response diversity (0.0-1.0).

```bash
export KUUZUKI_TOP_P="0.9"
```

## Development & Debugging

### `DEBUG`
**Debug logging**

Enable debug logging for specific modules.

```bash
export DEBUG="*"                    # All modules
export DEBUG="permission,agent"     # Specific modules
export DEBUG="model,session"        # Multiple modules
```

**Available modules:**
- `permission` - Permission system
- `agent` - Agent management
- `model` - Model operations
- `session` - Session management
- `tool` - Tool execution
- `auth` - Authentication
- `config` - Configuration loading

### `LOG_LEVEL`
**Global log level**

Set the minimum log level to display.

```bash
export LOG_LEVEL="DEBUG"
export LOG_LEVEL="INFO"
export LOG_LEVEL="WARN"
export LOG_LEVEL="ERROR"
```

### `KUUZUKI_DEV_MODE`
**Development mode**

Enable development features and verbose logging.

```bash
export KUUZUKI_DEV_MODE="true"
```

### `KUUZUKI_PRINT_LOGS`
**Print logs to stderr**

Force log output to stderr (useful for debugging).

```bash
export KUUZUKI_PRINT_LOGS="true"
```

## System Configuration

### `KUUZUKI_SERVER_PORT`
**Default server port**

Set the default port for server mode.

```bash
export KUUZUKI_SERVER_PORT="4096"
export KUUZUKI_SERVER_PORT="8080"
```

### `KUUZUKI_SERVER_HOST`
**Default server host**

Set the default host for server mode.

```bash
export KUUZUKI_SERVER_HOST="localhost"
export KUUZUKI_SERVER_HOST="0.0.0.0"
```

### `KUUZUKI_TIMEOUT`
**Request timeout**

Set timeout for AI requests (in milliseconds).

```bash
export KUUZUKI_TIMEOUT="30000"      # 30 seconds
export KUUZUKI_TIMEOUT="60000"      # 60 seconds
```

### `KUUZUKI_RETRY_COUNT`
**Request retry count**

Number of retries for failed requests.

```bash
export KUUZUKI_RETRY_COUNT="3"
export KUUZUKI_RETRY_COUNT="5"
```

### `NO_COLOR`
**Disable colored output**

Disable ANSI color codes in output.

```bash
export NO_COLOR="1"
```

### `TERM`
**Terminal type**

Specify terminal capabilities.

```bash
export TERM="xterm-256color"
export TERM="screen-256color"
```

## Priority and Precedence

Environment variables follow this priority order (highest to lowest):

1. **Command-line arguments** (e.g., `--model`, `--log-level`)
2. **Environment variables** (e.g., `OPENCODE_PERMISSION`, `KUUZUKI_MODEL`)
3. **Project `.agentrc`** (in current directory)
4. **User `.agentrc`** (in `~/.config/kuuzuki/`)
5. **System defaults**

### Example Priority Resolution

```bash
# Environment variable
export KUUZUKI_MODEL="anthropic/claude-3-sonnet"

# .agentrc file
{
  "model": {
    "default": "anthropic/claude-3-opus"
  }
}

# Command line (highest priority)
kuuzuki run "help" --model "anthropic/claude-3-haiku"

# Result: Uses claude-3-haiku (command line wins)
```

## Configuration Examples

### Development Environment

```bash
# Development setup
export ANTHROPIC_API_KEY="sk-ant-..."
export KUUZUKI_MODEL="anthropic/claude-3-sonnet"
export DEBUG="*"
export LOG_LEVEL="DEBUG"
export KUUZUKI_DEV_MODE="true"
export KUUZUKI_PRINT_LOGS="true"

# Permissive permissions for development
export OPENCODE_PERMISSION='{
  "bash": "allow",
  "edit": "allow",
  "write": "allow",
  "read": "allow",
  "webfetch": "allow"
}'
```

### Production Environment

```bash
# Production setup
export ANTHROPIC_API_KEY="sk-ant-..."
export KUUZUKI_MODEL="anthropic/claude-3-sonnet"
export LOG_LEVEL="WARN"

# Restrictive permissions for production
export OPENCODE_PERMISSION='{
  "bash": {
    "git status": "allow",
    "git log": "allow",
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

### CI/CD Environment

```bash
# CI/CD setup
export ANTHROPIC_API_KEY="$CI_ANTHROPIC_API_KEY"
export KUUZUKI_MODEL="anthropic/claude-3-haiku"  # Faster/cheaper
export LOG_LEVEL="INFO"
export KUUZUKI_TIMEOUT="60000"

# CI-specific permissions
export OPENCODE_PERMISSION='{
  "bash": {
    "npm test": "allow",
    "npm run build": "allow",
    "git *": "allow",
    "*": "ask"
  },
  "read": "allow",
  "write": "deny",
  "edit": "deny"
}'
```

### Docker Environment

```dockerfile
# Dockerfile
FROM node:18

# Set environment variables
ENV ANTHROPIC_API_KEY=""
ENV KUUZUKI_MODEL="anthropic/claude-3-sonnet"
ENV KUUZUKI_CONFIG_DIR="/app/.config"
ENV KUUZUKI_DATA_DIR="/app/.data"
ENV LOG_LEVEL="INFO"

# Secure permissions for container
ENV OPENCODE_PERMISSION='{\
  "bash": {\
    "npm *": "allow",\
    "node *": "allow",\
    "*": "deny"\
  },\
  "read": "allow",\
  "write": "ask",\
  "edit": "ask",\
  "webfetch": "deny"\
}'

# Install kuuzuki
RUN npm install -g kuuzuki

# Set working directory
WORKDIR /app

# Copy application
COPY . .

# Run kuuzuki
CMD ["kuuzuki", "serve"]
```

## Validation and Troubleshooting

### Check Environment Variables

```bash
# Check if variables are set
echo "API Key: ${ANTHROPIC_API_KEY:0:10}..."
echo "Model: $KUUZUKI_MODEL"
echo "Config Dir: $KUUZUKI_CONFIG_DIR"

# Validate JSON format
echo $OPENCODE_PERMISSION | jq .
```

### Common Issues

#### Invalid JSON in OPENCODE_PERMISSION

```bash
# Test JSON validity
echo $OPENCODE_PERMISSION | jq . > /dev/null && echo "Valid JSON" || echo "Invalid JSON"

# Fix common issues
export OPENCODE_PERMISSION='{"bash":"ask","edit":"allow"}'  # Use single quotes
```

#### Missing API Key

```bash
# Check if key is set
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ANTHROPIC_API_KEY is not set"
else
  echo "API key is configured"
fi
```

#### Permission Conflicts

```bash
# Debug permission resolution
DEBUG=permission kuuzuki run "test command"
```

### Environment Variable Testing

```bash
# Test script to validate environment
#!/bin/bash

echo "=== kuuzuki Environment Check ==="

# Check required variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ ANTHROPIC_API_KEY not set"
else
  echo "✅ ANTHROPIC_API_KEY configured"
fi

# Check optional variables
echo "Model: ${KUUZUKI_MODEL:-default}"
echo "Config Dir: ${KUUZUKI_CONFIG_DIR:-default}"
echo "Log Level: ${LOG_LEVEL:-INFO}"

# Validate JSON permissions
if [ -n "$OPENCODE_PERMISSION" ]; then
  if echo "$OPENCODE_PERMISSION" | jq . > /dev/null 2>&1; then
    echo "✅ OPENCODE_PERMISSION valid JSON"
  else
    echo "❌ OPENCODE_PERMISSION invalid JSON"
  fi
fi

echo "=== Environment Check Complete ==="
```

## Security Considerations

### API Key Security

- Never commit API keys to version control
- Use secure environment variable management in CI/CD
- Rotate API keys regularly
- Use least-privilege permissions

### Permission Security

- Start with restrictive permissions and add as needed
- Use `deny` for dangerous operations in production
- Regularly audit permission configurations
- Use environment variables for deployment-specific permissions

### Container Security

```bash
# Use secrets management
docker run -e ANTHROPIC_API_KEY_FILE=/run/secrets/api_key kuuzuki

# Or use environment files
docker run --env-file .env.production kuuzuki
```

## See Also

- [CLI Commands Reference](CLI_COMMANDS.md)
- [Agent Permission System](AGENT_PERMISSION_SYSTEM.md)
- [Model Configuration Guide](MODEL_CONFIGURATION.md)
- [Quick Start Guide](QUICKSTART.md)