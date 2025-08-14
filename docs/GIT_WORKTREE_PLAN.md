# Git Worktree Management Plan for Kuuzuki

## Overview

This plan outlines the implementation of automatic git worktree management for kuuzuki sessions. Each kuuzuki instance in a git project will create an isolated worktree, allowing multiple concurrent sessions without conflicts.

## Architecture

### Core Components

1. **WorktreeManager** - Central service for worktree lifecycle management
2. **SessionWorktree** - Session-specific worktree tracking and operations
3. **GitDetector** - Git project detection and validation
4. **MergeStrategy** - Configurable merge/cleanup strategies

### Session Integration

- Worktrees are created during session initialization for git projects
- Session ID is used to generate unique worktree names
- Worktree path is tracked in session metadata
- Cleanup happens on session termination or explicit user action

## Implementation Details

### 1. Git Project Detection

```typescript
interface GitProjectInfo {
  isGitRepo: boolean
  rootPath: string
  currentBranch: string
  hasUncommittedChanges: boolean
  remoteUrl?: string
}

class GitDetector {
  static async detect(cwd: string): Promise<GitProjectInfo>
  static async isCleanWorkingTree(path: string): Promise<boolean>
  static async getCurrentBranch(path: string): Promise<string>
}
```

### 2. Worktree Lifecycle Management

```typescript
interface WorktreeInfo {
  sessionId: string
  path: string
  branch: string
  baseBranch: string
  created: number
  lastAccessed: number
  status: 'active' | 'idle' | 'cleanup_pending'
}

class WorktreeManager {
  // Create worktree for session
  static async createForSession(sessionId: string, basePath: string): Promise<WorktreeInfo>
  
  // List all kuuzuki worktrees
  static async listWorktrees(): Promise<WorktreeInfo[]>
  
  // Cleanup worktree
  static async cleanup(sessionId: string, strategy: CleanupStrategy): Promise<void>
  
  // Auto-cleanup idle worktrees
  static async pruneIdle(maxAge: number): Promise<void>
}
```

### 3. Merge Strategies

```typescript
enum MergeStrategy {
  AUTO_MERGE = 'auto_merge',      // Attempt automatic merge to base branch
  CREATE_PR = 'create_pr',        // Create pull request (if GitHub/GitLab)
  STASH_CHANGES = 'stash_changes', // Stash changes for later
  DISCARD = 'discard',            // Discard all changes
  MANUAL = 'manual'               // Leave for manual resolution
}

interface CleanupStrategy {
  merge: MergeStrategy
  deleteWorktree: boolean
  backupChanges: boolean
  notifyUser: boolean
}
```

## Worktree Naming Convention

- Format: `kuuzuki-{sessionId}-{timestamp}`
- Location: `{projectRoot}/.kuuzuki/worktrees/`
- Branch: `kuuzuki/{sessionId}`

Example:
```
project-root/
├── .git/
├── .kuuzuki/
│   └── worktrees/
│       ├── kuuzuki-abc123-1703123456/
│       └── kuuzuki-def456-1703123789/
└── main-project-files...
```

## Session Integration Points

### 1. Session Creation
```typescript
// In session/index.ts - Session.create()
export async function create(options: CreateOptions): Promise<Info> {
  const session = await createBasicSession(options)
  
  // Check if we're in a git project
  const gitInfo = await GitDetector.detect(app.path.cwd)
  if (gitInfo.isGitRepo && options.useWorktree !== false) {
    const worktree = await WorktreeManager.createForSession(session.id, app.path.cwd)
    session.worktree = worktree
    
    // Update app.path.cwd to point to worktree
    app.path.cwd = worktree.path
  }
  
  return session
}
```

### 2. Session Cleanup
```typescript
// In session/index.ts - Session.remove()
export async function remove(sessionID: string): Promise<void> {
  const session = await get(sessionID)
  
  if (session.worktree) {
    const strategy = await getCleanupStrategy(session)
    await WorktreeManager.cleanup(sessionID, strategy)
  }
  
  // Continue with normal session cleanup...
}
```

## CLI Commands

### New Commands
```bash
# List all kuuzuki worktrees
kuuzuki worktree list

# Cleanup specific worktree
kuuzuki worktree cleanup <session-id> [--strategy=auto_merge|create_pr|stash|discard]

# Merge worktree changes
kuuzuki worktree merge <session-id> [--target-branch=main]

# Prune idle worktrees
kuuzuki worktree prune [--max-age=24h]

# Show worktree status
kuuzuki worktree status <session-id>
```

### Configuration Options
```json
// In .agentrc
{
  "worktree": {
    "enabled": true,
    "autoCleanup": true,
    "defaultMergeStrategy": "auto_merge",
    "maxIdleTime": "24h",
    "location": ".kuuzuki/worktrees"
  }
}
```

## Merge/Cleanup Strategies

### 1. Auto Merge Strategy
```typescript
async function autoMergeStrategy(worktree: WorktreeInfo): Promise<void> {
  // 1. Check if base branch has conflicts
  const conflicts = await checkMergeConflicts(worktree.path, worktree.baseBranch)
  
  if (conflicts.length === 0) {
    // 2. Switch to base branch and merge
    await git.checkout(worktree.baseBranch)
    await git.merge(worktree.branch)
    
    // 3. Push if remote exists
    if (await hasRemote()) {
      await git.push()
    }
  } else {
    // 4. Fall back to stash strategy
    await stashChangesStrategy(worktree)
  }
}
```

### 2. Create PR Strategy
```typescript
async function createPRStrategy(worktree: WorktreeInfo): Promise<void> {
  // 1. Push branch to remote
  await git.push('origin', worktree.branch)
  
  // 2. Create PR using GitHub/GitLab API
  const pr = await createPullRequest({
    title: `Kuuzuki Session Changes - ${worktree.sessionId}`,
    head: worktree.branch,
    base: worktree.baseBranch,
    body: generatePRDescription(worktree)
  })
  
  // 3. Notify user
  console.log(`Created PR: ${pr.url}`)
}
```

### 3. Stash Changes Strategy
```typescript
async function stashChangesStrategy(worktree: WorktreeInfo): Promise<void> {
  // 1. Create descriptive stash
  const stashMessage = `kuuzuki-session-${worktree.sessionId}-${Date.now()}`
  await git.stash('push', '-m', stashMessage)
  
  // 2. Store stash reference for later retrieval
  await Storage.writeJSON(`worktree/stash/${worktree.sessionId}`, {
    stashMessage,
    branch: worktree.branch,
    timestamp: Date.now()
  })
}
```

## Safety Features

### 1. Conflict Detection
- Check for uncommitted changes before creating worktree
- Validate that base branch is clean
- Detect merge conflicts before auto-merge

### 2. Backup Mechanisms
- Automatic stashing of changes before cleanup
- Backup worktree contents to `.kuuzuki/backups/`
- Recovery commands for accidental deletions

### 3. User Notifications
- Prompt before destructive operations
- Show summary of changes before merge/cleanup
- Provide recovery instructions

## Error Handling

### Common Scenarios
1. **Git not available** - Fall back to normal session without worktree
2. **Insufficient disk space** - Warn user and skip worktree creation
3. **Permission issues** - Provide clear error messages and solutions
4. **Merge conflicts** - Offer manual resolution or alternative strategies
5. **Network issues** - Handle remote operations gracefully

## Performance Considerations

### 1. Worktree Creation
- Use `git worktree add --detach` for faster creation
- Lazy-load git operations only when needed
- Cache git repository information

### 2. Cleanup Optimization
- Batch cleanup operations
- Background cleanup for idle worktrees
- Incremental cleanup to avoid blocking

### 3. Storage Management
- Monitor disk usage in worktree directory
- Implement size limits and warnings
- Automatic cleanup of old backups

## Testing Strategy

### Unit Tests
- GitDetector functionality
- WorktreeManager operations
- Merge strategy implementations
- Error handling scenarios

### Integration Tests
- Full session lifecycle with worktrees
- Multi-session concurrent usage
- Cleanup and recovery operations
- CLI command functionality

### Manual Testing Scenarios
1. Create multiple concurrent sessions in same project
2. Test all merge strategies
3. Verify cleanup on session termination
4. Test error recovery scenarios
5. Performance testing with large repositories

## Migration Plan

### Phase 1: Core Implementation
- Implement GitDetector and WorktreeManager
- Basic worktree creation and cleanup
- Simple auto-merge strategy

### Phase 2: Advanced Features
- Multiple merge strategies
- CLI commands
- Configuration options
- Backup and recovery

### Phase 3: Polish and Optimization
- Performance optimizations
- Enhanced error handling
- User experience improvements
- Documentation and examples

## Configuration Examples

### Basic Setup
```json
{
  "worktree": {
    "enabled": true,
    "defaultMergeStrategy": "auto_merge"
  }
}
```

### Advanced Setup
```json
{
  "worktree": {
    "enabled": true,
    "location": ".kuuzuki/worktrees",
    "defaultMergeStrategy": "create_pr",
    "autoCleanup": true,
    "maxIdleTime": "12h",
    "backupChanges": true,
    "strategies": {
      "auto_merge": {
        "allowFastForward": true,
        "requireCleanBase": true
      },
      "create_pr": {
        "template": "kuuzuki-session-template",
        "assignReviewer": true
      }
    }
  }
}
```

## Benefits

1. **Isolation** - Each session works in its own worktree
2. **Concurrency** - Multiple sessions can run simultaneously
3. **Safety** - Changes are isolated until explicitly merged
4. **Flexibility** - Multiple merge strategies for different workflows
5. **Recovery** - Built-in backup and recovery mechanisms
6. **Integration** - Seamless integration with existing kuuzuki features

## Potential Challenges

1. **Disk Usage** - Worktrees consume additional disk space
2. **Complexity** - Additional complexity in session management
3. **Git Knowledge** - Users need basic understanding of git concepts
4. **Performance** - Large repositories may have slower worktree creation
5. **Compatibility** - Some git operations may behave differently in worktrees

## Future Enhancements

1. **Smart Branching** - Automatic branch creation based on task context
2. **Collaborative Features** - Share worktrees between team members
3. **Integration with IDEs** - Automatic IDE workspace switching
4. **Advanced Merge Strategies** - AI-assisted conflict resolution
5. **Cloud Sync** - Sync worktrees across different machines