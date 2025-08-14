# Shell Command Guide

## Overview

Kuuzuki v0.2.0 introduces powerful shell command integration that allows you to execute shell commands directly in the TUI using the `!cmd` syntax. This feature provides real-time output streaming, visual feedback, and seamless integration with the existing permission system.

## Quick Start

### Basic Usage

Execute any shell command by prefixing it with `!`:

```bash
!ls -la                    # List files with details
!pwd                       # Show current directory
!git status                # Check git status
!npm install               # Install dependencies
!docker ps                 # List running containers
```

### Visual Feedback

When you type `!` in the TUI editor, you'll see a helpful hint:
```
Enter send   !cmd shell
```

This indicates that shell command mode is active.

## Features

### Real-Time Output Streaming

Commands execute with live output streaming:

- **Progressive display**: See output as it's generated
- **Performance metrics**: Track execution time and data transfer
- **Visual indicators**: Animated streaming status (●●● Streaming...)
- **Memory optimization**: Automatic truncation for large outputs

### Example with Streaming

```bash
!find . -name "*.js" | head -20
```

You'll see:
1. Immediate command execution
2. Real-time file discovery
3. Progress indicators during execution
4. Final results with performance metrics

### Error Handling

Failed commands show clear error messages:

```bash
!invalid-command
# Shows: Shell command failed: command not found
```

## Advanced Usage

### Long-Running Commands

For commands that take time to complete:

```bash
!npm run build
!docker build -t myapp .
!pytest tests/
```

Features during execution:
- **Live progress**: See build output in real-time
- **Performance tracking**: Monitor execution time and data transfer
- **Cancellation**: Use Ctrl+C to cancel long-running commands
- **Memory management**: Automatic output truncation for large builds

### Complex Commands

Shell command integration supports complex command structures:

```bash
!grep -r "TODO" . | grep -v node_modules
!find . -type f -name "*.py" | xargs wc -l
!docker run --rm -v $(pwd):/app node:18 npm test
```

### Environment Variables

Commands inherit your shell environment:

```bash
!echo $PATH
!echo $HOME
!env | grep NODE
```

## Permission System Integration

### Default Behavior

Shell commands respect your permission configuration:

```json
{
  "permission": {
    "bash": "ask"  // Will prompt for each command
  }
}
```

### Pattern-Based Permissions

Configure specific permissions for different command patterns:

```json
{
  "permission": {
    "bash": {
      "git *": "allow",      // Allow all git commands
      "npm *": "allow",      // Allow all npm commands
      "rm *": "deny",        // Block all rm commands
      "docker *": "ask",     // Ask for docker commands
      "*": "ask"             // Ask for everything else
    }
  }
}
```

### Environment Variable Override

Use environment variables for temporary permission changes:

```bash
export OPENCODE_PERMISSION='{
  "bash": {
    "ls *": "allow",
    "pwd": "allow",
    "*": "ask"
  }
}'
```

## Performance and Optimization

### Memory Management

- **Line limit**: Output automatically truncated at 1000 lines
- **Buffer management**: Efficient handling of large outputs
- **Real-time processing**: Minimal memory footprint during streaming

### Performance Metrics

Each command execution provides:
- **Execution time**: Total time from start to completion
- **Data transfer**: Bytes received from command output
- **Line count**: Number of output lines processed
- **Transfer rate**: Average bytes per second

### Example Output

```
$ npm test ●●● Streaming... [15s, 2.1MB]
✓ All tests passed
Command completed in 15.3s (2.1MB transferred, 142KB/s)
```

## Security Considerations

### Safe Defaults

- **Permission prompts**: Unknown commands prompt for confirmation
- **Pattern validation**: Command patterns are validated before execution
- **Environment isolation**: Commands run in the same security context as bash tool

### Best Practices

1. **Use specific patterns**: Configure specific permissions for common commands
2. **Avoid wildcards**: Be careful with broad permission patterns
3. **Regular review**: Periodically review and update permission configurations
4. **Environment separation**: Use different permissions for development vs production

### Example Secure Configuration

```json
{
  "permission": {
    "bash": {
      "git status": "allow",
      "git log": "allow",
      "git diff": "allow",
      "ls *": "allow",
      "pwd": "allow",
      "cat *": "allow",
      "grep *": "allow",
      "find *": "ask",
      "npm test": "allow",
      "npm run build": "ask",
      "docker *": "deny",
      "rm *": "deny",
      "sudo *": "deny",
      "*": "ask"
    }
  }
}
```

## Troubleshooting

### Common Issues

#### Command Not Found

```bash
!invalid-command
# Error: Shell command failed: command not found
```

**Solution**: Verify the command exists in your PATH:
```bash
!which invalid-command
!echo $PATH
```

#### Permission Denied

```bash
!rm important-file
# Error: Permission denied by configuration
```

**Solution**: Check your permission configuration:
```bash
# View current permissions
kuuzuki config show permission

# Update permissions if needed
export OPENCODE_PERMISSION='{"bash": {"rm *": "ask"}}'
```

#### Output Truncation

For commands with very large output:

```bash
!find / -name "*.log" 2>/dev/null
# Output may be truncated at 1000 lines
```

**Solution**: Use more specific commands or pipe to files:
```bash
!find /var/log -name "*.log" | head -50
!find / -name "*.log" 2>/dev/null > search-results.txt
```

#### Slow Performance

For commands that seem slow:

```bash
!npm install  # Taking a long time
```

**Debugging**:
1. Check network connectivity
2. Monitor system resources
3. Use more specific commands
4. Consider running outside kuuzuki for very large operations

### Debug Mode

Enable debug logging for shell commands:

```bash
DEBUG=bash kuuzuki tui
```

This provides detailed information about:
- Command parsing and validation
- Permission checking
- Execution timing
- Output processing

## Integration with AI

### Command Suggestions

The AI can suggest shell commands based on context:

```
User: "How do I check the git status?"
AI: "You can check git status with: !git status"
```

### Command Explanation

Ask the AI to explain complex commands:

```
User: "What does this command do: !find . -name '*.js' -exec grep -l 'TODO' {} \;"
AI: "This command finds all JavaScript files and lists those containing 'TODO'"
```

### Automated Workflows

Combine AI assistance with shell commands:

```
User: "Help me deploy this application"
AI: "I'll help you deploy. First, let's check the current status:
!git status
!npm run build
!docker build -t myapp .
!docker run -d -p 3000:3000 myapp"
```

## Examples and Use Cases

### Development Workflow

```bash
# Check project status
!git status
!npm test

# Build and deploy
!npm run build
!docker build -t myapp .
!kubectl apply -f deployment.yaml
```

### System Administration

```bash
# System monitoring
!ps aux | grep node
!df -h
!free -m
!netstat -tulpn | grep :3000
```

### File Operations

```bash
# File management
!find . -name "*.log" -mtime +7 -delete
!tar -czf backup.tar.gz src/
!rsync -av src/ backup/
```

### Database Operations

```bash
# Database tasks
!pg_dump mydb > backup.sql
!mysql -u root -p < schema.sql
!redis-cli ping
```

## Best Practices

### Command Organization

1. **Group related commands**: Use consistent patterns for related operations
2. **Use descriptive names**: Make command purposes clear
3. **Document complex commands**: Add comments for complex operations

### Performance Optimization

1. **Use specific paths**: Avoid broad searches that scan entire filesystems
2. **Limit output**: Use `head`, `tail`, or `grep` to limit output size
3. **Background operations**: Use `&` for long-running background tasks

### Security Guidelines

1. **Principle of least privilege**: Grant minimal necessary permissions
2. **Regular audits**: Review and update permission configurations
3. **Environment separation**: Use different configurations for different environments
4. **Sensitive operations**: Always require confirmation for destructive operations

## Future Enhancements

### Planned Features

- **Command history**: Access to previous shell commands
- **Command templates**: Predefined command templates for common tasks
- **Output filtering**: Real-time filtering and highlighting of command output
- **Background execution**: Run commands in background with notifications
- **Command scheduling**: Schedule commands for later execution

### Integration Opportunities

- **CI/CD integration**: Direct integration with CI/CD pipelines
- **Monitoring tools**: Integration with system monitoring tools
- **Log analysis**: Enhanced log analysis and parsing capabilities
- **Cloud services**: Direct integration with cloud service CLIs

---

The shell command integration in kuuzuki v0.2.0 provides a powerful and secure way to execute shell commands directly within your AI-powered terminal assistant, combining the flexibility of shell access with the intelligence of AI assistance.