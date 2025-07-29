# Implementation Plan: Complete Git Permission System (Remaining 15%)

## Overview

Complete the Git permission system by addressing the 6 identified gaps, focusing on critical integration points and user experience improvements.

## Phase 1: Critical Fixes (Priority 1)

### 1.1 Register CLI Commands

**File**: `packages/kuuzuki/src/index.ts`
**Estimated Time**: 30 minutes

**Tasks**:

- Import Git permission commands from `./cli/cmd/git-permissions.js`
- Add commands to yargs CLI builder:

  ```typescript
  import {
    GitPermissionsStatusCommand,
    GitPermissionsAllowCommand,
    GitPermissionsDenyCommand,
    GitPermissionsResetCommand,
    GitPermissionsConfigureCommand
  } from "./cli/cmd/git-permissions.js"

  // Add to CLI:
  .command(GitPermissionsStatusCommand)
  .command(GitPermissionsAllowCommand)
  .command(GitPermissionsDenyCommand)
  .command(GitPermissionsResetCommand)
  .command(GitPermissionsConfigureCommand)
  ```

**Validation**:

- Test `kuuzuki git status` command works
- Test `kuuzuki git allow commits` updates configuration
- Verify help text displays correctly

### 1.2 Implement .agentrc Auto-Update

**File**: `packages/kuuzuki/src/git/operations.ts`
**Estimated Time**: 45 minutes

**Tasks**:

- Create `updateAgentrcConfig()` function
- Handle `promptResult.updateConfig === true` in commit/push operations
- Update configuration file atomically
- Add error handling for file write operations

**Implementation**:

```typescript
private async updateAgentrcConfig(operation: GitOperation, mode: PermissionMode): Promise<void> {
  // Load current .agentrc
  // Update git permissions
  // Write back to file
  // Log success/failure
}

// In commit() method:
if (promptResult.scope === "project" && promptResult.updateConfig) {
  await this.updateAgentrcConfig("commit", "project")
}
```

**Validation**:

- Test project permission creates/updates `.agentrc`
- Verify file format is preserved
- Test error handling for read-only directories

### 1.3 Integrate Bash Tool with Git Permissions

**File**: `packages/kuuzuki/src/tool/bash.ts`
**Estimated Time**: 60 minutes

**Tasks**:

- Add Git command detection regex patterns
- Import Git safety system
- Intercept Git operations before execution
- Provide user feedback for blocked operations

**Implementation**:

```typescript
// Add before command execution:
const gitCommandPattern = /^git\s+(commit|push|config\s+user\.)/
if (gitCommandPattern.test(params.command)) {
  const gitSafety = createGitSafetySystem(await loadAgentrcConfig())
  // Check permissions and potentially block/redirect
}
```

**Validation**:

- Test `git commit` via bash tool requires permission
- Test `git push` via bash tool respects settings
- Verify non-Git commands unaffected

## Phase 2: Important Fixes (Priority 2)

### 2.1 Fix GitHub Integration Types

**File**: `packages/kuuzuki/src/cli/cmd/github.ts`
**Estimated Time**: 30 minutes

**Tasks**:

- Fix remaining type compatibility issues
- Ensure proper AgentrcConfig structure
- Add type assertions where needed
- Test GitHub integration flows

**Implementation**:

```typescript
// Fix remaining instances with proper project config:
const gitSafety = createGitSafetySystem({
  project: { name: "github-integration", type: "github-action" },
  git: {
    /* proper config */
  },
} as AgentrcConfig)
```

### 2.2 Fix CLI Commands Type Issues

**File**: `packages/kuuzuki/src/cli/cmd/git-permissions.ts`
**Estimated Time**: 45 minutes

**Tasks**:

- Fix property access using bracket notation
- Ensure proper null checking for git config
- Add type guards for configuration objects
- Test all CLI command flows

**Implementation**:

```typescript
// Fix git config access:
if (!newConfig.git) {
  newConfig.git = {
    commitMode: "ask" as const,
    pushMode: "never" as const,
    configMode: "never" as const,
    preserveAuthor: true,
    requireConfirmation: true,
    maxCommitSize: 100,
  }
}
```

## Phase 3: Quality & Documentation (Priority 3)

### 3.1 Create Test Suite

**New File**: `packages/kuuzuki/test/git-permissions.test.ts`
**Estimated Time**: 2 hours

**Test Categories**:

- **Unit Tests**: Permission manager logic, prompt system
- **Integration Tests**: CLI commands, .agentrc updates
- **Edge Cases**: Invalid configs, permission conflicts
- **User Flows**: Complete permission grant/deny scenarios

**Test Structure**:

```typescript
describe("Git Permission System", () => {
  describe("GitPermissionManager", () => {
    test("should deny commits by default")
    test("should grant session permissions")
    test("should validate branch restrictions")
  })

  describe("CLI Commands", () => {
    test("git status shows current permissions")
    test("git allow updates configuration")
  })

  describe("Integration", () => {
    test("GitHub integration respects permissions")
    test("Bash tool blocks unauthorized Git commands")
  })
})
```

### 3.2 Create User Documentation

**New File**: `docs/GIT_PERMISSIONS.md`
**Estimated Time**: 90 minutes

**Documentation Sections**:

- **Overview**: What the system does and why
- **Quick Start**: Basic setup and common commands
- **Configuration**: All .agentrc options explained
- **CLI Reference**: Complete command documentation
- **Troubleshooting**: Common issues and solutions
- **Migration**: Upgrading from previous versions

### 3.3 Update Main README

**File**: `README.md`
**Estimated Time**: 30 minutes

**Updates**:

- Add Git permission system to feature list
- Include security section highlighting protection
- Add quick example of permission configuration
- Link to detailed documentation

## Phase 4: Advanced Features (Optional)

### 4.1 Enhanced Permission Scopes

**Estimated Time**: 90 minutes

**Features**:

- **Repository-specific permissions**: Different rules per repo
- **Time-based permissions**: Temporary access grants
- **User-based permissions**: Different rules for different Git users

### 4.2 Integration with Other Tools

**Estimated Time**: 60 minutes

**Integrations**:

- **LSP tool**: Block Git operations in language server
- **File tools**: Warn when modifying files in Git repos
- **Task tool**: Respect Git permissions in automated tasks

## Implementation Timeline

### Week 1: Critical Fixes

- **Day 1**: Register CLI commands (1.1)
- **Day 2**: Implement .agentrc auto-update (1.2)
- **Day 3**: Integrate bash tool (1.3)
- **Day 4**: Fix type issues (2.1, 2.2)
- **Day 5**: Testing and validation

### Week 2: Quality & Documentation

- **Day 1-2**: Create comprehensive test suite (3.1)
- **Day 3-4**: Write user documentation (3.2, 3.3)
- **Day 5**: Final testing and polish

### Optional Week 3: Advanced Features

- **Day 1-3**: Enhanced permission scopes (4.1)
- **Day 4-5**: Additional tool integrations (4.2)

## Success Criteria

### Functional Requirements

- ✅ All CLI commands accessible and working
- ✅ Project permissions automatically update .agentrc
- ✅ Bash tool respects Git permissions
- ✅ No type errors in any component
- ✅ GitHub integration works seamlessly

### Quality Requirements

- ✅ 90%+ test coverage for Git permission code
- ✅ Complete user documentation
- ✅ All edge cases handled gracefully
- ✅ Performance impact < 100ms for permission checks

### User Experience Requirements

- ✅ Intuitive CLI commands with helpful error messages
- ✅ Clear permission status visibility
- ✅ Smooth onboarding for new users
- ✅ Minimal disruption to existing workflows

## Risk Mitigation

### Technical Risks

- **Config file corruption**: Atomic writes with backup/restore
- **Performance impact**: Cache permission checks, lazy loading
- **Type compatibility**: Comprehensive type testing

### User Experience Risks

- **Confusion about permissions**: Clear documentation and examples
- **Workflow disruption**: Gradual rollout with opt-in
- **Support burden**: Comprehensive troubleshooting guide

## Estimated Total Time

- **Critical fixes**: 2.25 hours
- **Important fixes**: 1.25 hours
- **Quality & docs**: 4 hours
- **Testing & validation**: 1 hour
- **Total**: ~8.5 hours for complete implementation

This plan will bring the Git permission system from 85% to 100% completion, ensuring a robust, user-friendly, and well-documented security feature for Kuuzuki.

## Implementation Status

- **Created**: 2025-01-28
- **Status**: Ready for implementation
- **Priority**: High - Security feature completion
- **Dependencies**: None
- **Estimated Completion**: 2 weeks
