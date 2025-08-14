# OPENCODE_PERMISSION Environment Variable Implementation Summary

## Overview

Successfully implemented the OPENCODE_PERMISSION environment variable system from OpenCode commit 5a17f44d, providing JSON-based permission configuration via environment variables for kuuzuki.

## Key Features Implemented

### 1. Environment Variable Support
- **Variable Name**: `OPENCODE_PERMISSION`
- **Format**: JSON string containing permission configuration
- **Priority**: Environment > Config File > Defaults

### 2. JSON Schema Validation
- Full Zod schema validation for environment permissions
- Graceful error handling for malformed JSON
- Detailed logging for debugging permission resolution

### 3. Permission Configuration Formats

#### Array Format (kuuzuki style)
```json
["rm *", "git push *", "npm install"]
```

#### Object Format with Tool Permissions
```json
{
  "bash": "ask",
  "edit": "allow", 
  "write": "deny",
  "read": "allow"
}
```

#### Pattern-Based Permissions
```json
{
  "bash": {
    "rm *": "ask",
    "git *": "allow",
    "*": "deny"
  }
}
```

#### Agent-Level Permissions
```json
{
  "bash": "ask",
  "agents": {
    "bugfinder": {
      "bash": "allow",
      "write": "deny"
    }
  }
}
```

#### Tool Name Pattern Matching
```json
{
  "tools": {
    "bash*": "ask",
    "edit": "allow",
    "*": "deny"
  }
}
```

### 4. Priority System Implementation

The permission resolution follows this priority order:

1. **Environment Variable** (`OPENCODE_PERMISSION`) - Highest priority
2. **Configuration File** (`kuuzuki.json`, `.agentrc`) - Medium priority
3. **Default Behavior** (allow) - Lowest priority

### 5. Enhanced Pattern Matching

- **Command Patterns**: `"git *"`, `"rm *"`, `"npm install"`
- **Tool Name Patterns**: `"bash*"`, `"*read*"`, `"edit"`
- **Priority-based matching**: More specific patterns take precedence
- **Wildcard support**: Full glob-style pattern matching

## Files Modified

### 1. `packages/kuuzuki/src/config/schema.ts`
- Added `OPENCODE_PERMISSION` to environment variable mappings
- Enhanced `parseEnvironmentVariables()` with JSON parsing for permissions
- Added validation and error handling for malformed JSON

### 2. `packages/kuuzuki/src/config/config.ts`
- Integrated environment permission parsing into config loading
- Added logging for environment permission loading
- Ensured proper merging with config file permissions

### 3. `packages/kuuzuki/src/permission/index.ts`
- Implemented `getEnvironmentPermissions()` function
- Enhanced `checkPermission()` with priority system
- Added comprehensive error handling and validation
- Implemented `evaluatePermissions()` for permission resolution
- Added support for tool name pattern matching
- Enhanced agent-level permission support

### 4. `packages/kuuzuki/src/util/wildcard.ts`
- Enhanced pattern matching with priority calculation
- Added tool name pattern matching functions
- Improved specificity calculation for better pattern resolution

## Security Considerations

### 1. Input Validation
- Full JSON schema validation using Zod
- Graceful handling of malformed JSON
- Detailed error logging without exposing sensitive data

### 2. Error Handling
- Malformed JSON is ignored with warnings
- Invalid permission values are rejected
- System falls back to safe defaults on errors

### 3. Principle of Least Privilege
- Default behavior is "allow" for backward compatibility
- Environment can override to be more restrictive
- Agent-level permissions can further restrict access

### 4. Audit Trail
- Comprehensive logging of permission decisions
- Source tracking (environment vs config vs default)
- Pattern matching details for debugging

## Testing

### 1. Unit Tests (`permission-environment.test.ts`)
- JSON parsing validation
- Schema validation
- Error handling for malformed input
- Integration with config schema
- Pattern matching verification

### 2. Integration Tests (`permission-integration.test.ts`)
- End-to-end permission resolution
- Priority system verification
- Agent-level permission testing
- Complex pattern matching scenarios
- Error handling in real scenarios

### 3. Test Coverage
- ✅ Valid JSON permission configurations
- ✅ Array and object format support
- ✅ Malformed JSON handling
- ✅ Environment variable priority
- ✅ Agent-level permissions
- ✅ Pattern-based permissions
- ✅ Tool name pattern matching
- ✅ Error scenarios and fallbacks

## Usage Examples

### CI/CD Environment
```bash
export OPENCODE_PERMISSION='{
  "bash": {
    "npm test": "allow",
    "npm run build": "allow",
    "*": "deny"
  },
  "read": "allow",
  "write": "deny"
}'
```

### Development Environment
```bash
export OPENCODE_PERMISSION='{
  "bash": {
    "rm -rf *": "ask",
    "sudo *": "ask",
    "*": "allow"
  },
  "edit": "allow",
  "write": "allow"
}'
```

### Production Deployment
```bash
export OPENCODE_PERMISSION='{
  "bash": {
    "docker ps": "allow",
    "kubectl get *": "allow",
    "*": "deny"
  },
  "read": "allow",
  "write": "deny",
  "edit": "deny"
}'
```

## Deployment Considerations

### 1. Container Environments
- Environment variable can be set in Dockerfile
- Kubernetes ConfigMaps can provide complex configurations
- Docker Compose can inject environment-specific permissions

### 2. CI/CD Integration
- GitHub Actions can set restrictive permissions
- Jenkins pipelines can use different permission sets per stage
- GitLab CI can enforce security policies via environment

### 3. Monitoring and Debugging
- Enable debug logging: `DEBUG=kuuzuki:permission`
- Permission decisions are logged with source information
- Pattern matching details available for troubleshooting

## Backward Compatibility

- Existing config file permissions continue to work
- Environment variable is optional
- Default behavior remains "allow" for smooth migration
- No breaking changes to existing APIs

## Performance Impact

- Minimal overhead: Environment variable parsed once at startup
- Pattern matching uses efficient algorithms
- Caching of permission decisions where appropriate
- No impact on non-permission-related operations

## Future Enhancements

1. **Dynamic Permission Updates**: Hot-reload of environment permissions
2. **Permission Auditing**: Detailed audit logs for compliance
3. **Role-Based Permissions**: User/role-specific permission sets
4. **Remote Permission Sources**: Fetch permissions from external services
5. **Permission Templates**: Predefined permission sets for common scenarios

## Conclusion

The OPENCODE_PERMISSION environment variable implementation provides a robust, secure, and flexible permission system that maintains full compatibility with OpenCode while enhancing kuuzuki's security capabilities for deployment environments and CI/CD systems.

The implementation follows security best practices, provides comprehensive error handling, and maintains excellent performance characteristics while offering the flexibility needed for various deployment scenarios.