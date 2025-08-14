# CLI Commands Reference

Complete reference for all kuuzuki CLI commands and features.

## Table of Contents

- [Basic Commands](#basic-commands)
- [Shell Commands (!commands)](#shell-commands-commands)
- [Global Options](#global-options)
- [Model Configuration](#model-configuration)
- [Environment Variables](#environment-variables)
- [Permission System](#permission-system)
- [Agent Configuration](#agent-configuration)

## Basic Commands

### `kuuzuki` (default)
Start the interactive TUI mode.

```bash
kuuzuki
# or
kuuzuki tui
```

**Options:**
- `--print-logs` - Print logs to stderr
- `--log-level` - Set log level (DEBUG, INFO, WARN, ERROR)

### `kuuzuki run <prompt>`
Execute a single command with AI assistance.

```bash
kuuzuki run "explain this error: permission denied"
kuuzuki run "create a React component for user profile"
```

**Options:**
- `--model <model>` - Specify AI model to use
- `--agent <agent>` - Use specific agent configuration

### `kuuzuki serve`
Start kuuzuki as a server for external integrations.

```bash
kuuzuki serve
kuuzuki serve --port 8080
```

**Options:**
- `--port <port>` - Server port (default: 4096)
- `--host <host>` - Server host (default: localhost)

### `kuuzuki models`
List all available AI models.

```bash
kuuzuki models
```

Output format: `provider/model-name`

### `kuuzuki auth`
Manage authentication and API keys.

```bash
kuuzuki auth login
kuuzuki auth logout
kuuzuki auth status
```

### `kuuzuki agent`
Manage agent configurations.

```bash
kuuzuki agent list
kuuzuki agent create <name>
kuuzuki agent delete <name>
```

### `kuuzuki apikey`
Manage API keys for AI providers.

```bash
kuuzuki apikey set anthropic <key>
kuuzuki apikey list
kuuzuki apikey remove anthropic
```

### `kuuzuki github`
GitHub integration commands.

```bash
kuuzuki github setup
kuuzuki github status
```

### `kuuzuki stats`
View usage statistics.

```bash
kuuzuki stats
kuuzuki stats --detailed
```

### `kuuzuki bugfind`
Run automated bug detection.

```bash
kuuzuki bugfind
kuuzuki bugfind --agent bugfinder
```

### `kuuzuki mcp`
Manage MCP (Model Context Protocol) servers.

```bash
kuuzuki mcp list
kuuzuki mcp install <server>
kuuzuki mcp remove <server>
```

## Shell Commands (!commands)

Execute shell commands directly in the TUI by prefixing with `!`.

### Basic Usage

```bash
!ls -la                    # List files with details
!pwd                       # Show current directory
!git status                # Check git status
!npm install               # Install dependencies
!docker ps                 # List running containers
!grep -r "pattern" .       # Search for patterns
```

### Features

- **Real-time output**: See command output as it executes
- **Session persistence**: Commands run in the same session context
- **Error handling**: Proper error reporting and exit codes
- **Security**: Respects permission system configuration

### Visual Feedback

The TUI shows `!cmd shell` hint in the editor status bar when available.

### Security

Shell commands respect the same permission system as the bash tool:
- Commands execute in the same security context
- Permission patterns apply to shell commands
- Environment variables and working directory are preserved

## Global Options

Available for all commands:

### `--print-logs`
Print detailed logs to stderr for debugging.

```bash
kuuzuki run "help me debug" --print-logs
```

### `--log-level <level>`
Set the logging level.

```bash
kuuzuki serve --log-level DEBUG
```

**Levels:** DEBUG, INFO, WARN, ERROR

### `--model <model>`
Specify which AI model to use.

```bash
kuuzuki run "explain this code" --model anthropic/claude-3-opus
```

**Available models:** Use `kuuzuki models` to see all options.

### `--agent <agent>`
Use a specific agent configuration.

```bash
kuuzuki run "review this code" --agent code-reviewer
```

## Model Configuration

### Global Model Settings

Configure default models in `.agentrc`:

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

### Model Selection Priority

1. CLI `--model` argument (highest priority)
2. Agent-specific model configuration
3. Global default model
4. System default

### Available Providers

- **Anthropic**: claude-3-opus, claude-3-sonnet, claude-3-haiku
- **OpenAI**: gpt-4, gpt-3.5-turbo
- **GitHub Copilot**: Various models (requires GitHub authentication)

### Model-Specific Options

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "options": {
      "temperature": 0.1,
      "maxTokens": 8192,
      "topP": 0.9
    }
  }
}
```

## Environment Variables

### Required Variables

#### `ANTHROPIC_API_KEY`
Your Anthropic API key for Claude models.

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Optional Variables

#### `OPENCODE_PERMISSION`
JSON configuration for permissions (overrides .agentrc).

```bash
export OPENCODE_PERMISSION='{
  "bash": "ask",
  "edit": "allow",
  "agents": {
    "code-reviewer": {
      "bash": "allow"
    }
  }
}'
```

#### `KUUZUKI_MODEL`
Default model to use.

```bash
export KUUZUKI_MODEL="anthropic/claude-3-opus"
```

#### `KUUZUKI_CONFIG_DIR`
Custom configuration directory.

```bash
export KUUZUKI_CONFIG_DIR="$HOME/.config/kuuzuki"
```

#### `DEBUG`
Enable debug logging for specific modules.

```bash
export DEBUG="permission,agent,model"
```

### Environment Variable Priority

1. `OPENCODE_PERMISSION` (highest priority)
2. `.agentrc` configuration file
3. System defaults

## Permission System

Control what tools and commands kuuzuki can execute.

### Basic Configuration

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

### Permission Levels

- **`allow`**: Execute without asking
- **`ask`**: Prompt user for confirmation
- **`deny`**: Block execution

### Pattern-Based Permissions

```json
{
  "permission": {
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "rm *": "deny",
      "*": "ask"
    }
  }
}
```

### Agent-Specific Permissions

```json
{
  "permission": {
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
  }
}
```

### Legacy Array Format

Still supported for backward compatibility:

```json
{
  "permission": ["git *", "npm *", "ls *"]
}
```

## Agent Configuration

Agents are specialized AI assistants with specific capabilities and permissions.

### Built-in Agents

#### `grounding`
Fact-checking and verification agent.

```json
{
  "agents": {
    "grounding": {
      "model": "anthropic/claude-3-sonnet",
      "tools": ["webfetch", "read", "grep", "bash", "memory"],
      "prompt": "You are a grounding agent focused on fact-checking..."
    }
  }
}
```

#### `code-reviewer`
Expert code review agent.

```json
{
  "agents": {
    "code-reviewer": {
      "model": "anthropic/claude-3-opus",
      "tools": ["read", "bash", "grep"],
      "prompt": "You are an expert code reviewer..."
    }
  }
}
```

#### `documentation`
Documentation specialist.

```json
{
  "agents": {
    "documentation": {
      "model": "anthropic/claude-3-sonnet",
      "tools": ["read", "write", "edit", "grep"],
      "prompt": "You are a documentation specialist..."
    }
  }
}
```

#### `bugfinder`
Expert debugging agent.

```json
{
  "agents": {
    "bugfinder": {
      "model": "anthropic/claude-3-opus",
      "tools": ["bash", "read", "grep", "edit"],
      "prompt": "You are an expert debugging agent..."
    }
  }
}
```

### Custom Agent Configuration

```json
{
  "agents": {
    "my-agent": {
      "model": "anthropic/claude-3-sonnet",
      "temperature": 0.1,
      "tools": ["read", "write", "bash"],
      "prompt": "You are a specialized agent for...",
      "permission": {
        "bash": "allow",
        "edit": "ask"
      }
    }
  }
}
```

### Agent Properties

- **`model`**: AI model to use
- **`temperature`**: Response randomness (0.0-1.0)
- **`tools`**: Available tools for the agent
- **`prompt`**: System prompt defining agent behavior
- **`permission`**: Agent-specific permissions

### Using Agents

```bash
# Use agent in CLI
kuuzuki run "review this code" --agent code-reviewer

# Use agent in TUI
# Type your message and specify agent in conversation
```

### Agent Tool Restrictions

Agents can be restricted to specific tools:

```json
{
  "agents": {
    "safe-agent": {
      "tools": ["read", "grep"],
      "permission": {
        "bash": "deny",
        "write": "deny"
      }
    }
  }
}
```

## Configuration Files

### `.agentrc`
Main configuration file in JSON format.

**Location:** Project root or `~/.config/kuuzuki/`

**Example:**
```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet"
  },
  "permission": {
    "bash": "ask",
    "edit": "allow"
  },
  "agents": {
    "my-agent": {
      "model": "anthropic/claude-3-opus"
    }
  }
}
```

### Configuration Priority

1. Project `.agentrc`
2. User `~/.config/kuuzuki/.agentrc`
3. Environment variables
4. System defaults

## Examples

### Basic Usage

```bash
# Start interactive mode
kuuzuki

# Quick command
kuuzuki run "explain this error: ENOENT"

# Use specific model
kuuzuki run "write tests" --model anthropic/claude-3-opus

# Use specific agent
kuuzuki run "review code" --agent code-reviewer
```

### Shell Commands in TUI

```bash
# In TUI, type commands with ! prefix:
!git status
!npm test
!docker build -t myapp .
!find . -name "*.js" | head -10
```

### Permission Configuration

```bash
# Set via environment variable
export OPENCODE_PERMISSION='{"bash":"ask","edit":"allow"}'

# Or in .agentrc
{
  "permission": {
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "*": "ask"
    }
  }
}
```

### Agent Usage

```bash
# List available agents
kuuzuki agent list

# Use agent for specific task
kuuzuki run "find bugs in this code" --agent bugfinder

# Create custom agent
kuuzuki agent create my-reviewer
```

## Troubleshooting

### Common Issues

#### Command not found
```bash
# Install globally
npm install -g kuuzuki

# Check installation
which kuuzuki
```

#### API key not found
```bash
# Set API key
export ANTHROPIC_API_KEY="your-key-here"

# Verify it's set
echo $ANTHROPIC_API_KEY
```

#### Permission denied
```bash
# Check permissions in .agentrc
cat .agentrc

# Or set via environment
export OPENCODE_PERMISSION='{"bash":"allow"}'
```

#### Model not available
```bash
# List available models
kuuzuki models

# Check provider configuration
kuuzuki auth status
```

### Debug Mode

Enable detailed logging:

```bash
kuuzuki run "help" --print-logs --log-level DEBUG
```

### Log Files

Logs are stored in:
- `~/.local/share/kuuzuki/log/`
- Use `--print-logs` to see logs in terminal

## See Also

- [Agent Permission System](AGENT_PERMISSION_SYSTEM.md)
- [Quick Start Guide](QUICKSTART.md)
- [Environment Variables Reference](ENVIRONMENT_VARIABLES.md)
- [Model Configuration Guide](MODEL_CONFIGURATION.md)