# Model Configuration Guide

Complete guide for configuring AI models in kuuzuki.

## Table of Contents

- [Overview](#overview)
- [Available Models](#available-models)
- [Configuration Methods](#configuration-methods)
- [Model Selection Priority](#model-selection-priority)
- [Model-Specific Options](#model-specific-options)
- [Provider Configuration](#provider-configuration)
- [Agent-Specific Models](#agent-specific-models)
- [Performance Tuning](#performance-tuning)
- [Cost Optimization](#cost-optimization)

## Overview

kuuzuki supports multiple AI providers and models, allowing you to choose the best model for your specific use case. Models can be configured globally, per-agent, or per-command.

### Key Features

- **Multiple Providers**: Anthropic, OpenAI, GitHub Copilot
- **Flexible Configuration**: Global defaults, agent-specific, command-line override
- **Cost Control**: Choose models based on cost and performance needs
- **Quality Tuning**: Adjust temperature, tokens, and other parameters

## Available Models

### Anthropic (Claude)

**Required:** `ANTHROPIC_API_KEY`

```bash
# List all available models
kuuzuki models | grep anthropic

# Common models
anthropic/claude-3-opus      # Most capable, highest cost
anthropic/claude-3-sonnet    # Balanced performance/cost
anthropic/claude-3-haiku     # Fastest, lowest cost
```

**Characteristics:**
- **Claude 3 Opus**: Best for complex reasoning, code review, architecture
- **Claude 3 Sonnet**: Good balance for general development tasks
- **Claude 3 Haiku**: Fast responses for simple queries, debugging

### OpenAI (GPT)

**Required:** `OPENAI_API_KEY`

```bash
# List OpenAI models
kuuzuki models | grep openai

# Common models
openai/gpt-4                 # High quality, slower
openai/gpt-4-turbo          # Faster GPT-4 variant
openai/gpt-3.5-turbo        # Fast, cost-effective
```

### GitHub Copilot

**Required:** GitHub authentication

```bash
# List GitHub models
kuuzuki models | grep github

# Available through GitHub subscription
github/copilot-chat
```

## Configuration Methods

### 1. Command Line (Highest Priority)

```bash
# Specify model for single command
kuuzuki run "explain this code" --model anthropic/claude-3-opus

# Use with TUI
kuuzuki tui --model anthropic/claude-3-sonnet
```

### 2. Environment Variables

```bash
# Set default model
export KUUZUKI_MODEL="anthropic/claude-3-sonnet"

# Model-specific parameters
export KUUZUKI_TEMPERATURE="0.7"
export KUUZUKI_MAX_TOKENS="4096"
```

### 3. Configuration File (.agentrc)

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "temperature": 0.7,
    "maxTokens": 4096,
    "topP": 0.9
  }
}
```

### 4. Agent-Specific Configuration

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet"
  },
  "agents": {
    "code-reviewer": {
      "model": "anthropic/claude-3-opus",
      "temperature": 0.1
    },
    "documentation": {
      "model": "anthropic/claude-3-haiku",
      "temperature": 0.3
    }
  }
}
```

## Model Selection Priority

Models are selected in this order (highest to lowest priority):

1. **Command-line `--model` argument**
2. **Agent-specific model configuration**
3. **Environment variable `KUUZUKI_MODEL`**
4. **Global default in `.agentrc`**
5. **System default** (anthropic/claude-3-sonnet)

### Example Priority Resolution

```bash
# Environment variable
export KUUZUKI_MODEL="anthropic/claude-3-haiku"

# .agentrc configuration
{
  "model": {
    "default": "anthropic/claude-3-sonnet"
  },
  "agents": {
    "my-agent": {
      "model": "anthropic/claude-3-opus"
    }
  }
}

# Command execution
kuuzuki run "help" --agent my-agent --model anthropic/claude-3-haiku

# Result: Uses claude-3-haiku (command line wins)
```

## Model-Specific Options

### Temperature

Controls response randomness (0.0 = deterministic, 1.0 = creative).

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "temperature": 0.7
  }
}
```

**Recommended values:**
- **0.0-0.2**: Code generation, debugging, factual tasks
- **0.3-0.7**: General development, explanations
- **0.8-1.0**: Creative writing, brainstorming

### Max Tokens

Limits the length of AI responses.

```json
{
  "model": {
    "maxTokens": 4096
  }
}
```

**Common limits:**
- **1024**: Short responses, quick answers
- **4096**: Standard responses, code explanations
- **8192**: Long responses, detailed analysis
- **16384**: Very long responses, comprehensive documentation

### Top P (Nucleus Sampling)

Controls response diversity (0.0-1.0).

```json
{
  "model": {
    "topP": 0.9
  }
}
```

**Recommended values:**
- **0.1-0.5**: Focused, consistent responses
- **0.6-0.9**: Balanced creativity and consistency
- **0.9-1.0**: Maximum diversity

### Provider-Specific Options

#### Anthropic Options

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "options": {
      "temperature": 0.7,
      "maxTokens": 4096,
      "topP": 0.9,
      "topK": 40,
      "stopSequences": ["Human:", "Assistant:"]
    }
  }
}
```

#### OpenAI Options

```json
{
  "model": {
    "default": "openai/gpt-4",
    "options": {
      "temperature": 0.7,
      "maxTokens": 4096,
      "topP": 0.9,
      "frequencyPenalty": 0.0,
      "presencePenalty": 0.0
    }
  }
}
```

## Provider Configuration

### Anthropic Setup

```bash
# Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Verify access
kuuzuki models | grep anthropic
```

### OpenAI Setup

```bash
# Set API key
export OPENAI_API_KEY="sk-..."

# Verify access
kuuzuki models | grep openai
```

### GitHub Copilot Setup

```bash
# Authenticate with GitHub
kuuzuki auth login

# Verify access
kuuzuki models | grep github
```

## Agent-Specific Models

Configure different models for different types of tasks.

### Task-Optimized Configuration

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet"
  },
  "agents": {
    "code-reviewer": {
      "model": "anthropic/claude-3-opus",
      "temperature": 0.1,
      "maxTokens": 8192
    },
    "documentation": {
      "model": "anthropic/claude-3-sonnet",
      "temperature": 0.3,
      "maxTokens": 4096
    },
    "quick-help": {
      "model": "anthropic/claude-3-haiku",
      "temperature": 0.5,
      "maxTokens": 1024
    },
    "creative-writing": {
      "model": "anthropic/claude-3-opus",
      "temperature": 0.8,
      "maxTokens": 8192
    }
  }
}
```

### Use Case Examples

```bash
# Code review with high-quality model
kuuzuki run "review this code" --agent code-reviewer

# Quick help with fast model
kuuzuki run "what does this error mean?" --agent quick-help

# Documentation with balanced model
kuuzuki run "write API docs" --agent documentation
```

## Performance Tuning

### Response Speed Optimization

```json
{
  "model": {
    "default": "anthropic/claude-3-haiku",
    "temperature": 0.3,
    "maxTokens": 2048
  }
}
```

**Fast models:**
- anthropic/claude-3-haiku
- openai/gpt-3.5-turbo

### Quality Optimization

```json
{
  "model": {
    "default": "anthropic/claude-3-opus",
    "temperature": 0.1,
    "maxTokens": 8192
  }
}
```

**High-quality models:**
- anthropic/claude-3-opus
- openai/gpt-4

### Balanced Configuration

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "temperature": 0.5,
    "maxTokens": 4096
  }
}
```

## Cost Optimization

### Model Cost Comparison

**Anthropic (approximate costs):**
- Claude 3 Haiku: $0.25/$1.25 per 1M tokens (input/output)
- Claude 3 Sonnet: $3/$15 per 1M tokens
- Claude 3 Opus: $15/$75 per 1M tokens

**OpenAI (approximate costs):**
- GPT-3.5 Turbo: $0.50/$1.50 per 1M tokens
- GPT-4: $10/$30 per 1M tokens

### Cost-Effective Strategies

#### 1. Tiered Model Usage

```json
{
  "agents": {
    "quick-help": {
      "model": "anthropic/claude-3-haiku"
    },
    "general": {
      "model": "anthropic/claude-3-sonnet"
    },
    "complex-analysis": {
      "model": "anthropic/claude-3-opus"
    }
  }
}
```

#### 2. Token Limits

```json
{
  "model": {
    "maxTokens": 2048
  },
  "agents": {
    "quick-help": {
      "maxTokens": 512
    },
    "detailed-analysis": {
      "maxTokens": 8192
    }
  }
}
```

#### 3. Environment-Based Configuration

```bash
# Development (cost-effective)
export KUUZUKI_MODEL="anthropic/claude-3-haiku"

# Production (high-quality)
export KUUZUKI_MODEL="anthropic/claude-3-opus"
```

## Advanced Configuration

### Dynamic Model Selection

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "rules": {
      "codeReview": "anthropic/claude-3-opus",
      "quickHelp": "anthropic/claude-3-haiku",
      "documentation": "anthropic/claude-3-sonnet"
    }
  }
}
```

### Context-Aware Configuration

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "contextRules": {
      "fileSize": {
        "small": "anthropic/claude-3-haiku",
        "large": "anthropic/claude-3-opus"
      },
      "complexity": {
        "simple": "anthropic/claude-3-haiku",
        "complex": "anthropic/claude-3-opus"
      }
    }
  }
}
```

### Fallback Configuration

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "fallback": [
      "anthropic/claude-3-haiku",
      "openai/gpt-3.5-turbo"
    ]
  }
}
```

## Troubleshooting

### Common Issues

#### Model Not Available

```bash
# Check available models
kuuzuki models

# Verify API key
echo $ANTHROPIC_API_KEY

# Test authentication
kuuzuki auth status
```

#### Invalid Model Name

```bash
# Use exact model names from kuuzuki models
kuuzuki run "help" --model "anthropic/claude-3-sonnet"

# Not: claude-3-sonnet or claude3sonnet
```

#### Rate Limiting

```json
{
  "model": {
    "options": {
      "retryCount": 3,
      "retryDelay": 1000
    }
  }
}
```

#### Cost Concerns

```bash
# Use cost-effective models for development
export KUUZUKI_MODEL="anthropic/claude-3-haiku"

# Set token limits
export KUUZUKI_MAX_TOKENS="2048"
```

### Debug Model Selection

```bash
# Enable debug logging
DEBUG=model kuuzuki run "test" --print-logs

# Check model resolution
kuuzuki run "which model am I using?" --model anthropic/claude-3-opus
```

## Best Practices

### 1. Environment-Specific Configuration

```bash
# .env.development
KUUZUKI_MODEL="anthropic/claude-3-haiku"
KUUZUKI_MAX_TOKENS="2048"

# .env.production
KUUZUKI_MODEL="anthropic/claude-3-sonnet"
KUUZUKI_MAX_TOKENS="4096"
```

### 2. Task-Specific Agents

```json
{
  "agents": {
    "debugger": {
      "model": "anthropic/claude-3-sonnet",
      "temperature": 0.1
    },
    "explainer": {
      "model": "anthropic/claude-3-haiku",
      "temperature": 0.5
    },
    "architect": {
      "model": "anthropic/claude-3-opus",
      "temperature": 0.3
    }
  }
}
```

### 3. Progressive Enhancement

```json
{
  "model": {
    "default": "anthropic/claude-3-haiku",
    "agents": {
      "complex-tasks": {
        "model": "anthropic/claude-3-opus"
      }
    }
  }
}
```

### 4. Monitoring and Optimization

```bash
# Track usage
kuuzuki stats

# Monitor costs
kuuzuki stats --detailed

# Optimize based on usage patterns
```

## Configuration Examples

### Minimal Configuration

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet"
  }
}
```

### Balanced Configuration

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "temperature": 0.5,
    "maxTokens": 4096,
    "agents": {
      "quick-help": {
        "model": "anthropic/claude-3-haiku",
        "maxTokens": 1024
      }
    }
  }
}
```

### Advanced Configuration

```json
{
  "model": {
    "default": "anthropic/claude-3-sonnet",
    "temperature": 0.5,
    "maxTokens": 4096,
    "topP": 0.9,
    "options": {
      "retryCount": 3,
      "timeout": 30000
    },
    "agents": {
      "code-reviewer": {
        "model": "anthropic/claude-3-opus",
        "temperature": 0.1,
        "maxTokens": 8192
      },
      "documentation": {
        "model": "anthropic/claude-3-sonnet",
        "temperature": 0.3,
        "maxTokens": 6144
      },
      "quick-help": {
        "model": "anthropic/claude-3-haiku",
        "temperature": 0.5,
        "maxTokens": 1024
      }
    }
  }
}
```

## See Also

- [CLI Commands Reference](CLI_COMMANDS.md)
- [Environment Variables Reference](ENVIRONMENT_VARIABLES.md)
- [Agent Configuration Guide](AGENT_CONFIGURATION.md)
- [Quick Start Guide](QUICKSTART.md)