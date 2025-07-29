# API Key Management System

Kuuzuki includes a secure API key management system for storing and managing API keys for various AI providers. This system supports multiple storage backends including system keychain integration and provides health checking capabilities.

## Supported Providers

- **Anthropic Claude** (`anthropic`)
- **OpenAI** (`openai`)
- **OpenRouter** (`openrouter`)
- **GitHub Copilot** (`github-copilot`)
- **Amazon Bedrock** (`amazon-bedrock`)

## Storage Options

### 1. System Keychain (Recommended)

- **macOS**: Keychain Access
- **Linux**: Secret Service (libsecret)
- **Windows**: Credential Manager

### 2. Local File Storage

- Stored in `~/.kuuzuki/apikeys.json`
- Used as fallback when keychain is unavailable

### 3. Environment Variables

- Automatically detected from standard environment variables
- Takes precedence over stored keys

## CLI Commands

### Add API Key

```bash
# Store API key in system keychain (recommended)
kuuzuki apikey provider add anthropic sk-ant-api03-...

# Store API key in local file only
kuuzuki apikey provider add anthropic sk-ant-api03-... --no-keychain
```

### List Stored Keys

```bash
kuuzuki apikey provider list
```

### Test API Keys

```bash
# Test all stored keys
kuuzuki apikey provider test

# Test specific provider
kuuzuki apikey provider test anthropic
```

### Remove API Key

```bash
kuuzuki apikey provider remove anthropic
```

## Environment Variables

The system automatically detects API keys from these environment variables:

- `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `GITHUB_TOKEN` or `COPILOT_API_KEY`
- `AWS_ACCESS_KEY_ID` or `AWS_BEARER_TOKEN_BEDROCK`

## API Key Formats

### Anthropic Claude

- Format: `sk-ant-api03-[95 characters]`
- Example: `sk-ant-api03-abcd1234...`

### OpenAI

- Format: `sk-[48+ characters]`
- Example: `sk-abcd1234...`

### OpenRouter

- Format: `sk-or-v1-[64 hex characters]`
- Example: `sk-or-v1-abcd1234...`

### GitHub Copilot

- Format: `ghu_[36 characters]` or `ghp_[36 characters]`
- Example: `ghu_abcd1234...`

### Amazon Bedrock

- Format: `AKIA[16 uppercase alphanumeric]`
- Example: `AKIAABCD1234...`

## Programmatic Usage

### Basic Usage

```typescript
import { Config } from "./config/config"

// Store API key
await Config.ApiKeys.store("anthropic", "sk-ant-api03-...", true)

// Retrieve API key
const apiKey = await Config.ApiKeys.get("anthropic")

// Validate API key
const isValid = await Config.ApiKeys.validate("anthropic", apiKey)

// Health check
const health = await Config.ApiKeys.healthCheck("anthropic")
```

### Advanced Usage

```typescript
import { ApiKeyManager } from "./auth/apikey"
import { Providers } from "./auth/providers"

// Get manager instance
const manager = ApiKeyManager.getInstance()

// Detect provider from key
const providerId = Providers.detectProvider(apiKey)

// Auto-detect and store
const detectedProvider = await manager.detectAndStoreKey(apiKey)

// List all keys with metadata
const keys = await manager.listKeys()

// Health check all providers
const results = await manager.healthCheckAll()
```

## Security Features

### Key Masking

API keys are automatically masked in logs and CLI output:

- `sk-ant-api03-abcd****efgh1234`

### Secure Storage

- System keychain integration when available
- File permissions restricted to user only
- No keys stored in plain text in configuration files

### Health Checking

- Validates API keys against provider endpoints
- Tracks last successful usage
- Provides response time metrics

## Configuration Integration

API keys are automatically integrated with the provider system:

```json
{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

## Error Handling

The system provides detailed error messages for common issues:

- Invalid API key format
- Network connectivity problems
- Provider authentication failures
- Storage permission issues

## Migration

Existing API keys in configuration files are automatically migrated to the new system on first use.

## Best Practices

1. **Use Environment Variables** for CI/CD and production environments
2. **Enable Keychain Storage** for development machines
3. **Regular Health Checks** to ensure keys remain valid
4. **Key Rotation** - update keys periodically for security
5. **Minimal Permissions** - use provider-specific scoped keys when available

## Troubleshooting

### Keychain Issues

```bash
# Check if keychain is available
kuuzuki apikey provider list

# Force file storage
kuuzuki apikey provider add anthropic sk-ant-... --no-keychain
```

### Health Check Failures

```bash
# Test specific provider
kuuzuki apikey provider test anthropic

# Check network connectivity
curl -I https://api.anthropic.com/v1/messages
```

### Permission Errors

```bash
# Check file permissions
ls -la ~/.kuuzuki/

# Reset permissions
chmod 600 ~/.kuuzuki/apikeys.json
```
