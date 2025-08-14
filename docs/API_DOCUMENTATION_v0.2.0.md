# API Documentation - Kuuzuki v0.2.0

## Overview

Kuuzuki v0.2.0 introduces several new API endpoints and enhancements to support the new features including shell command execution, enhanced permission system, and API key management.

## Base URL

```
http://localhost:4096  # Default server port
```

## Authentication

All API requests require authentication via API key headers:

```http
Authorization: Bearer <api-key>
X-API-Key: <api-key>
```

## New Endpoints

### Shell Command Execution

#### Execute Shell Command
Execute a shell command in a session with real-time streaming support.

```http
POST /session/{sessionId}/shell
```

**Parameters:**
- `sessionId` (path, required): Session identifier

**Request Body:**
```json
{
  "command": "string"  // Shell command to execute
}
```

**Response:**
```json
{
  "id": "string",
  "type": "assistant",
  "parts": [
    {
      "type": "tool",
      "tool": "bash",
      "input": {
        "command": "string"
      },
      "output": "string",
      "metadata": {
        "streaming": true,
        "streamingIndicator": "●●● Streaming...",
        "progress": {
          "stdoutLines": 10,
          "stderrLines": 0,
          "elapsed": 5,
          "bytesReceived": 1024
        }
      }
    }
  ]
}
```

**Example:**
```bash
curl -X POST "http://localhost:4096/session/sess_123/shell" \
  -H "Authorization: Bearer sk-ant-..." \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la"}'
```

### Permission Management

#### Check Permission
Check if a specific action is permitted for an agent.

```http
POST /session/{sessionId}/permissions/check
```

**Request Body:**
```json
{
  "tool": "bash",
  "action": "git status",
  "agent": "code-reviewer"  // Optional
}
```

**Response:**
```json
{
  "permitted": true,
  "action": "allow",  // "allow" | "ask" | "deny"
  "reason": "Matched pattern: git *"
}
```

#### Request Permission
Request permission for a specific action (interactive).

```http
POST /session/{sessionId}/permissions/{permissionId}
```

**Request Body:**
```json
{
  "action": "allow"  // "allow" | "deny"
}
```

**Response:**
```json
{
  "id": "perm_123",
  "status": "resolved",
  "action": "allow"
}
```

### API Key Management

#### List API Keys
List all stored API keys with health status.

```http
GET /apikeys
```

**Response:**
```json
{
  "keys": [
    {
      "provider": "anthropic",
      "masked": "sk-ant-****-1234",
      "health": {
        "status": "healthy",
        "lastChecked": "2025-01-15T10:30:00Z",
        "responseTime": 250
      }
    }
  ]
}
```

#### Add API Key
Store a new API key securely.

```http
POST /apikeys
```

**Request Body:**
```json
{
  "provider": "anthropic",
  "key": "sk-ant-api03-...",
  "useKeychain": true
}
```

**Response:**
```json
{
  "success": true,
  "provider": "anthropic",
  "masked": "sk-ant-****-1234"
}
```

#### Test API Key
Test the health of a specific API key.

```http
POST /apikeys/{provider}/test
```

**Response:**
```json
{
  "provider": "anthropic",
  "status": "healthy",
  "responseTime": 245,
  "lastChecked": "2025-01-15T10:30:00Z"
}
```

#### Remove API Key
Remove a stored API key.

```http
DELETE /apikeys/{provider}
```

**Response:**
```json
{
  "success": true,
  "provider": "anthropic"
}
```

## Enhanced Endpoints

### Session Management

#### Create Session (Enhanced)
Create a new session with agent-specific permissions.

```http
POST /session
```

**Request Body:**
```json
{
  "agent": "code-reviewer",  // Optional: specify agent
  "permissions": {           // Optional: override permissions
    "bash": "allow",
    "edit": "ask"
  }
}
```

**Response:**
```json
{
  "id": "sess_123",
  "agent": "code-reviewer",
  "permissions": {
    "bash": "allow",
    "edit": "ask",
    "read": "allow",
    "write": "ask",
    "webfetch": "ask"
  }
}
```

#### Get Session (Enhanced)
Get session details including permission configuration.

```http
GET /session/{sessionId}
```

**Response:**
```json
{
  "id": "sess_123",
  "agent": "code-reviewer",
  "permissions": {
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "*": "ask"
    },
    "edit": "allow"
  },
  "stats": {
    "messages": 15,
    "toolCalls": 8,
    "permissionRequests": 2
  }
}
```

### Message Streaming (Enhanced)

#### Stream Messages
Enhanced message streaming with real-time tool execution updates.

```http
GET /session/{sessionId}/stream
```

**Server-Sent Events:**
```
event: message
data: {"type": "assistant", "content": "I'll help you with that."}

event: tool_start
data: {"tool": "bash", "command": "git status", "streaming": true}

event: tool_progress
data: {"tool": "bash", "progress": {"elapsed": 2, "bytesReceived": 512}}

event: tool_output
data: {"tool": "bash", "output": "On branch main\nnothing to commit"}

event: tool_complete
data: {"tool": "bash", "status": "completed", "elapsed": 3.2}
```

## WebSocket API

### Real-Time Updates

#### Connect to Session
Establish WebSocket connection for real-time updates.

```
ws://localhost:4096/session/{sessionId}/ws
```

**Message Types:**

#### Tool Execution Updates
```json
{
  "type": "tool_progress",
  "data": {
    "tool": "bash",
    "command": "npm test",
    "streaming": true,
    "progress": {
      "elapsed": 15,
      "bytesReceived": 2048,
      "stdoutLines": 25
    }
  }
}
```

#### Permission Requests
```json
{
  "type": "permission_request",
  "data": {
    "id": "perm_123",
    "tool": "bash",
    "action": "rm important-file.txt",
    "agent": "code-reviewer"
  }
}
```

#### Permission Response
```json
{
  "type": "permission_response",
  "data": {
    "id": "perm_123",
    "action": "deny"
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Action not permitted by configuration",
    "details": {
      "tool": "bash",
      "action": "rm *",
      "pattern": "rm *",
      "configured_action": "deny"
    }
  }
}
```

### Error Codes

#### Permission Errors
- `PERMISSION_DENIED`: Action explicitly denied by configuration
- `PERMISSION_REQUIRED`: Action requires user confirmation
- `PERMISSION_TIMEOUT`: Permission request timed out
- `INVALID_PERMISSION_ID`: Permission ID not found

#### API Key Errors
- `API_KEY_INVALID`: API key format is invalid
- `API_KEY_EXPIRED`: API key has expired
- `API_KEY_NOT_FOUND`: API key not found for provider
- `PROVIDER_UNAVAILABLE`: AI provider service unavailable

#### Shell Command Errors
- `COMMAND_FAILED`: Shell command execution failed
- `COMMAND_TIMEOUT`: Command execution timed out
- `COMMAND_DENIED`: Command blocked by permissions
- `INVALID_COMMAND`: Command format is invalid

#### Session Errors
- `SESSION_NOT_FOUND`: Session ID not found
- `SESSION_EXPIRED`: Session has expired
- `SESSION_LOCKED`: Session is locked by another process
- `AGENT_NOT_FOUND`: Specified agent not found

## Rate Limiting

### Limits
- **API requests**: 1000 requests per minute per API key
- **Shell commands**: 100 commands per minute per session
- **Permission requests**: 50 requests per minute per session
- **WebSocket connections**: 10 concurrent connections per API key

### Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
```

## Configuration API

### Get Configuration
Retrieve current configuration including permissions and providers.

```http
GET /config
```

**Response:**
```json
{
  "permissions": {
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "*": "ask"
    },
    "agents": {
      "code-reviewer": {
        "bash": "allow",
        "edit": "allow"
      }
    }
  },
  "providers": {
    "anthropic": {
      "available": true,
      "models": ["claude-3-sonnet", "claude-3-haiku"]
    }
  }
}
```

### Update Configuration
Update configuration (requires admin privileges).

```http
PUT /config
```

**Request Body:**
```json
{
  "permissions": {
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "*": "ask"
    }
  }
}
```

## Health Check

### System Health
Check overall system health including API keys and providers.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "0.2.0",
  "uptime": 3600,
  "providers": {
    "anthropic": {
      "status": "healthy",
      "responseTime": 250
    },
    "openai": {
      "status": "degraded",
      "responseTime": 1200
    }
  },
  "features": {
    "shell_commands": true,
    "agent_permissions": true,
    "api_key_management": true,
    "real_time_streaming": true
  }
}
```

## SDK Examples

### TypeScript/JavaScript

```typescript
import { KuuzukiClient } from 'kuuzuki-sdk'

const client = new KuuzukiClient({
  baseURL: 'http://localhost:4096',
  apiKey: 'sk-ant-...'
})

// Execute shell command
const result = await client.session.shell('sess_123', {
  command: 'git status'
})

// Check permission
const permission = await client.session.permissions.check('sess_123', {
  tool: 'bash',
  action: 'git push',
  agent: 'deployment'
})

// Manage API keys
await client.apiKeys.add({
  provider: 'anthropic',
  key: 'sk-ant-...'
})

const health = await client.apiKeys.test('anthropic')
```

### Python

```python
from kuuzuki_sdk import KuuzukiClient

client = KuuzukiClient(
    base_url='http://localhost:4096',
    api_key='sk-ant-...'
)

# Execute shell command
result = client.session.shell('sess_123', command='git status')

# Check permission
permission = client.session.permissions.check(
    'sess_123',
    tool='bash',
    action='git push',
    agent='deployment'
)

# Manage API keys
client.api_keys.add(provider='anthropic', key='sk-ant-...')
health = client.api_keys.test('anthropic')
```

### Go

```go
package main

import (
    "context"
    "github.com/moikas-code/kuuzuki/sdk/go"
)

func main() {
    client := kuuzuki.NewClient("http://localhost:4096", "sk-ant-...")
    
    // Execute shell command
    result, err := client.Session.Shell(context.Background(), "sess_123", kuuzuki.SessionShellParams{
        Command: kuuzuki.F("git status"),
    })
    
    // Check permission
    permission, err := client.Session.Permissions.Check(context.Background(), "sess_123", kuuzuki.PermissionCheckParams{
        Tool:   kuuzuki.F("bash"),
        Action: kuuzuki.F("git push"),
        Agent:  kuuzuki.F("deployment"),
    })
    
    // Manage API keys
    err = client.APIKeys.Add(context.Background(), kuuzuki.APIKeyAddParams{
        Provider: kuuzuki.F("anthropic"),
        Key:      kuuzuki.F("sk-ant-..."),
    })
}
```

## Migration from v0.1.x

### Deprecated Endpoints
- None - all v0.1.x endpoints remain functional

### New Required Headers
- None - existing authentication methods continue to work

### Enhanced Responses
- Session endpoints now include permission information
- Message streaming includes tool execution progress
- Error responses include more detailed information

---

This API documentation covers all the new and enhanced endpoints in Kuuzuki v0.2.0. All existing v0.1.x endpoints remain fully functional, ensuring backward compatibility.