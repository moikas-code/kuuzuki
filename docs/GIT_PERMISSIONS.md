# Git Permission System

Kuuzuki includes a comprehensive Git permission system that prevents accidental commits, pushes, and configuration changes while allowing you to grant permissions at different scopes when needed.

## Overview

The Git permission system provides:

- **Secure by default**: Prevents accidental Git operations
- **Flexible permissions**: Choose the right level for each project
- **User control**: Always in control of Git operations
- **Session memory**: Convenient for development sessions
- **Author preservation**: Respects your existing Git configuration

## Quick Start

### 1. Check Current Permissions

```bash
kuuzuki git status
```

This shows your current Git permission settings and repository status.

### 2. Allow Operations

```bash
# Allow commits for this project
kuuzuki git allow commits

# Allow pushes for this session only
kuuzuki git allow pushes

# Allow all operations
kuuzuki git allow all
```

### 3. Deny Operations

```bash
# Deny commits for this project
kuuzuki git deny commits

# Deny all operations
kuuzuki git deny all
```

### 4. Interactive Configuration

```bash
kuuzuki git configure
```

This opens an interactive prompt to configure all Git permissions.

## Permission Modes

### `never`

- **Description**: Completely disable the operation
- **Use case**: Maximum security, no Git operations allowed
- **Example**: Production environments, shared accounts

### `ask` (default for commits)

- **Description**: Prompt for permission each time
- **Use case**: Careful development, learning environments
- **Example**: When you want to review each commit

### `session`

- **Description**: Allow after first approval until Kuuzuki restarts
- **Use case**: Active development sessions
- **Example**: Working on a feature branch

### `project`

- **Description**: Always allow for this project (updates `.agentrc`)
- **Use case**: Trusted projects, personal repositories
- **Example**: Your own open-source projects

## Configuration

### .agentrc File

The Git permission system is configured via the `.agentrc` file in your project root:

```json
{
  "git": {
    "commitMode": "ask",
    "pushMode": "never",
    "configMode": "never",
    "preserveAuthor": true,
    "requireConfirmation": true,
    "maxCommitSize": 100,
    "allowedBranches": ["main", "develop"]
  }
}
```

### Configuration Options

#### `commitMode`

- **Type**: `"never" | "ask" | "session" | "project"`
- **Default**: `"ask"`
- **Description**: How to handle commit operations

#### `pushMode`

- **Type**: `"never" | "ask" | "session" | "project"`
- **Default**: `"never"`
- **Description**: How to handle push operations

#### `configMode`

- **Type**: `"never" | "ask" | "session" | "project"`
- **Default**: `"never"`
- **Description**: How to handle Git config changes

#### `preserveAuthor`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Preserve existing Git author settings

#### `requireConfirmation`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Always show commit preview before committing

#### `maxCommitSize`

- **Type**: `number`
- **Default**: `100`
- **Description**: Maximum number of files in a single commit

#### `allowedBranches`

- **Type**: `string[]`
- **Default**: `[]` (all branches allowed)
- **Description**: Branches where commits are allowed

## CLI Commands

### `kuuzuki git status`

Shows current Git permission settings and repository status.

```bash
🔐 Git Permission Status

📋 Current Settings:
   Commits:     ask
   Pushes:      never
   Config:      never
   Preserve Author: Yes
   Require Confirmation: Yes
   Max Commit Size: 100 files
   Allowed Branches: All branches

📁 Repository Status:
   Branch: main
   Status: Has changes
   Staged: 2 files
   Unstaged: 1 files
   Untracked: 0 files
```

### `kuuzuki git allow <operation>`

Allow Git operations for this project.

**Operations**: `commits`, `pushes`, `config`, `all`

```bash
# Examples
kuuzuki git allow commits
kuuzuki git allow pushes
kuuzuki git allow all
```

### `kuuzuki git deny <operation>`

Deny Git operations for this project.

**Operations**: `commits`, `pushes`, `config`, `all`

```bash
# Examples
kuuzuki git deny commits
kuuzuki git deny all
```

### `kuuzuki git reset`

Reset all Git permissions to defaults (ask for commits, deny pushes/config).

```bash
kuuzuki git reset
```

### `kuuzuki git configure`

Interactive configuration of all Git permissions.

```bash
kuuzuki git configure
```

## Integration with Tools

### Bash Tool Integration

The Git permission system automatically intercepts Git commands executed via the bash tool:

```bash
# This will check permissions before executing
kuuzuki run "git commit -m 'Update feature'"

# This will be blocked if pushes are disabled
kuuzuki run "git push origin main"
```

### GitHub Integration

When using Kuuzuki's GitHub integration features, the permission system:

- Respects your author preservation settings
- Only sets bot user if no Git user is configured
- Uses safe Git operations for all commits and pushes

## Security Features

### Default Security

- **Commits**: Require permission (`ask` mode)
- **Pushes**: Completely disabled (`never` mode)
- **Config changes**: Completely disabled (`never` mode)
- **Author preservation**: Enabled by default

### Branch Protection

Restrict commits to specific branches:

```json
{
  "git": {
    "allowedBranches": ["main", "develop", "feature/*"]
  }
}
```

### Commit Size Limits

Prevent accidentally large commits:

```json
{
  "git": {
    "maxCommitSize": 50
  }
}
```

### Author Protection

Prevent accidental author changes:

```json
{
  "git": {
    "preserveAuthor": true,
    "configMode": "never"
  }
}
```

## Common Workflows

### Development Workflow

```bash
# Start development
kuuzuki git allow commits  # Allow commits for this project
kuuzuki git status         # Check current settings

# During development - commits are allowed
# Kuuzuki can now commit changes when needed

# For deployment
kuuzuki git allow pushes   # Temporarily allow pushes
# Deploy changes
kuuzuki git deny pushes    # Disable pushes again
```

### Learning/Training Environment

```bash
# Maximum safety
kuuzuki git deny all       # Disable all Git operations
kuuzuki git configure      # Set up specific permissions as needed
```

### Trusted Project

```bash
# Allow everything for a trusted project
kuuzuki git allow all
```

### Temporary Session

```bash
# Allow commits for this session only
# (Use interactive prompts and choose "session" scope)
```

## Troubleshooting

### "Operation cancelled by user"

**Cause**: You denied permission when prompted.
**Solution**: Use `kuuzuki git allow <operation>` to enable the operation.

### "Git operation denied"

**Cause**: The operation is set to `never` mode.
**Solution**: Use `kuuzuki git allow <operation>` or `kuuzuki git configure`.

### "Not in a Git repository"

**Cause**: Trying to perform Git operations outside a Git repository.
**Solution**: Navigate to a Git repository or initialize one with `git init`.

### "Too many files to commit"

**Cause**: Commit exceeds `maxCommitSize` limit.
**Solution**:

- Commit fewer files at once
- Increase `maxCommitSize` in `.agentrc`
- Use `kuuzuki git configure` to adjust settings

### "Commits not allowed on branch"

**Cause**: Current branch is not in `allowedBranches` list.
**Solution**:

- Switch to an allowed branch
- Add current branch to `allowedBranches` in `.agentrc`
- Remove branch restrictions

### Permission settings not persisting

**Cause**: Using session permissions instead of project permissions.
**Solution**: When prompted, choose "Yes, always allow for this project" to update `.agentrc`.

## Migration from Previous Versions

If you're upgrading from a version without Git permissions:

1. **Existing projects**: Will use default settings (commits require permission, pushes disabled)
2. **First run**: You'll be prompted to configure permissions
3. **Gradual adoption**: Start with `ask` mode and adjust as needed

### Recommended Migration Steps

1. Check current status:

   ```bash
   kuuzuki git status
   ```

2. Configure for your workflow:

   ```bash
   kuuzuki git configure
   ```

3. Test with a small change:

   ```bash
   # Make a small change and see how permissions work
   ```

4. Adjust as needed:
   ```bash
   kuuzuki git allow commits  # If you want to enable commits
   ```

## Best Practices

### For Individual Developers

- Use `ask` mode for commits to review each change
- Keep pushes disabled (`never`) unless actively deploying
- Enable author preservation
- Set reasonable commit size limits

### For Teams

- Document team Git permission policies
- Use branch restrictions for protected branches
- Consider project-wide permissions for trusted repositories
- Regular review of permission settings

### For Production

- Use `never` mode for all operations
- Implement strict branch restrictions
- Enable all safety features
- Regular audits of permission changes

## Advanced Configuration

### Environment-Specific Settings

Create different `.agentrc` files for different environments:

```bash
# Development
cp .agentrc.dev .agentrc

# Production
cp .agentrc.prod .agentrc
```

### Conditional Permissions

Use branch-specific permissions:

```json
{
  "git": {
    "commitMode": "project",
    "allowedBranches": ["feature/*", "bugfix/*"],
    "pushMode": "never"
  }
}
```

### Integration with CI/CD

For automated environments:

```json
{
  "git": {
    "commitMode": "project",
    "pushMode": "project",
    "configMode": "project",
    "preserveAuthor": false,
    "requireConfirmation": false
  }
}
```

## Support

If you encounter issues with the Git permission system:

1. Check the [troubleshooting section](#troubleshooting)
2. Review your `.agentrc` configuration
3. Use `kuuzuki git status` to understand current settings
4. Try `kuuzuki git reset` to restore defaults
5. Report issues at [GitHub Issues](https://github.com/moikas-code/kuuzuki/issues)

## Related Documentation

- [Configuration Guide](./CONFIGURATION.md)
- [CLI Reference](./CLI.md)
- [Security Best Practices](./SECURITY.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
