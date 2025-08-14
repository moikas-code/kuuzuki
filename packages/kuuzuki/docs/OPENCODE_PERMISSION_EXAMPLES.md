# OPENCODE_PERMISSION Environment Variable Examples

The `OPENCODE_PERMISSION` environment variable allows you to configure kuuzuki permissions via JSON, providing a secure way to control tool access in deployment environments and CI/CD systems.

## Priority System

Permissions are resolved in the following order:
1. **Environment Variable** (`OPENCODE_PERMISSION`) - Highest priority
2. **Configuration File** (`kuuzuki.json`, `.agentrc`) - Medium priority  
3. **Default Behavior** (allow) - Lowest priority

## Configuration Formats

### 1. Simple Array Format (kuuzuki style)

```bash
export OPENCODE_PERMISSION='["rm *", "git push *", "npm install"]'
```

This format asks for permission for any commands matching the patterns.

### 2. Object Format with Tool-Level Permissions

```bash
export OPENCODE_PERMISSION='{
  "bash": "ask",
  "edit": "allow", 
  "write": "deny",
  "read": "allow"
}'
```

### 3. Pattern-Based Bash Permissions

```bash
export OPENCODE_PERMISSION='{
  "bash": {
    "rm *": "ask",
    "git *": "allow",
    "npm *": "allow",
    "*": "deny"
  },
  "edit": "allow",
  "write": "ask"
}'
```

### 4. Agent-Level Permissions

```bash
export OPENCODE_PERMISSION='{
  "bash": "ask",
  "edit": "allow",
  "agents": {
    "bugfinder": {
      "bash": "allow",
      "write": "deny"
    },
    "code-reviewer": {
      "bash": "deny",
      "edit": "allow",
      "read": "allow"
    }
  }
}'
```

### 5. Tool Name Pattern Matching

```bash
export OPENCODE_PERMISSION='{
  "tools": {
    "bash*": "ask",
    "edit": "allow", 
    "*read*": "allow",
    "*": "deny"
  }
}'
```

### 6. Complex Production Configuration

```bash
export OPENCODE_PERMISSION='{
  "bash": {
    "git status": "allow",
    "git log *": "allow",
    "git diff *": "allow",
    "npm test": "allow",
    "npm run build": "allow",
    "rm *": "ask",
    "sudo *": "deny",
    "*": "ask"
  },
  "edit": "ask",
  "write": "ask", 
  "read": "allow",
  "webfetch": "ask",
  "tools": {
    "dangerous-tool": "deny"
  },
  "agents": {
    "ci-agent": {
      "bash": {
        "npm test": "allow",
        "npm run build": "allow",
        "*": "deny"
      },
      "read": "allow",
      "write": "deny"
    },
    "deployment-agent": {
      "bash": {
        "docker *": "allow",
        "kubectl *": "allow",
        "*": "ask"
      },
      "read": "allow",
      "write": "allow"
    }
  }
}'
```

## Permission Actions

- **`"allow"`** - Automatically allow the operation
- **`"ask"`** - Prompt the user for permission
- **`"deny"`** - Automatically deny the operation

## Pattern Matching

### Bash Command Patterns

- `"git *"` - Matches any git command
- `"rm *"` - Matches any rm command  
- `"npm install"` - Matches exact command
- `"*"` - Matches any command (wildcard)

### Tool Name Patterns

- `"bash*"` - Matches bash, bash-extended, etc.
- `"*read*"` - Matches read, file-read, etc.
- `"edit"` - Matches exact tool name

## Security Best Practices

### 1. Principle of Least Privilege

```bash
# Start restrictive, allow specific operations
export OPENCODE_PERMISSION='{
  "bash": {
    "git status": "allow",
    "npm test": "allow",
    "*": "ask"
  },
  "read": "allow",
  "edit": "ask",
  "write": "ask"
}'
```

### 2. CI/CD Environment

```bash
# Automated testing environment
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
```

### 3. Development Environment

```bash
# More permissive for development
export OPENCODE_PERMISSION='{
  "bash": {
    "rm -rf *": "ask",
    "sudo *": "ask", 
    "*": "allow"
  },
  "edit": "allow",
  "write": "allow",
  "read": "allow"
}'
```

### 4. Production Deployment

```bash
# Highly restricted production environment
export OPENCODE_PERMISSION='{
  "bash": {
    "docker ps": "allow",
    "kubectl get *": "allow",
    "systemctl status *": "allow",
    "*": "deny"
  },
  "read": "allow",
  "write": "deny",
  "edit": "deny",
  "webfetch": "deny"
}'
```

## Error Handling

The system gracefully handles malformed JSON:

```bash
# Invalid JSON - will be ignored with warning
export OPENCODE_PERMISSION='{ invalid json }'

# Invalid permission values - will be ignored with warning  
export OPENCODE_PERMISSION='{"bash": "invalid_value"}'

# Empty or whitespace - will be ignored
export OPENCODE_PERMISSION='   '
```

## Integration Examples

### Docker Container

```dockerfile
FROM node:18
ENV OPENCODE_PERMISSION='{"bash":{"npm *":"allow","git *":"allow","*":"ask"},"read":"allow","write":"ask"}'
RUN npm install -g kuuzuki
```

### GitHub Actions

```yaml
- name: Run kuuzuki with restricted permissions
  env:
    OPENCODE_PERMISSION: '{"bash":{"npm test":"allow","*":"deny"},"read":"allow","write":"deny"}'
  run: kuuzuki run "Run the test suite"
```

### Kubernetes Deployment

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kuuzuki-permissions
data:
  OPENCODE_PERMISSION: |
    {
      "bash": {
        "kubectl get *": "allow",
        "docker ps": "allow",
        "*": "ask"
      },
      "read": "allow",
      "write": "deny"
    }
```

## Debugging

Enable debug logging to see permission resolution:

```bash
export DEBUG=kuuzuki:permission
export OPENCODE_PERMISSION='{"bash":"ask"}'
kuuzuki run "list files"
```

This will show detailed logs about how permissions are resolved and which configuration source is used.