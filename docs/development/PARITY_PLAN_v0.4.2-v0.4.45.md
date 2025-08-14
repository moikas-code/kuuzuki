# Kuuzuki Parity Plan: OpenCode v0.4.2 → v0.4.45

## Executive Summary

This document outlines a comprehensive plan to sync kuuzuki with OpenCode upstream changes from version 0.4.2 to 0.4.45. The analysis reveals **189 commits** across 43 version releases, including significant new features, critical bug fixes, and infrastructure improvements.

## Current Status Analysis

- **Kuuzuki Version**: 0.1.35 (based on OpenCode ~v0.4.2)
- **Target OpenCode Version**: v0.4.45
- **Commits to Review**: 189 commits
- **Version Gap**: 43 releases
- **Upstream Remote**: ✅ Configured (upstream/dev)
- **Fork Status**: Significantly diverged with custom features

## Change Categories Analysis

### 🚀 Major Features (12 commits)
1. **Bash/Shell Commands** (`1357319f`, `93b71477`)
   - New `!shell` command support
   - Interactive bash command execution
   - **Impact**: High - Core functionality addition

2. **Session Management** (`47c32764`)
   - Session rename functionality in TUI
   - **Impact**: Medium - UX improvement

3. **File Attachments** (`a4c14dbb`, `81a3e024`)
   - Convert attachments to text on delete
   - Improved file attachment pasting
   - **Impact**: Medium - File handling enhancement

4. **Thinking Blocks** (`b8d2aebf`)
   - Rendered in TUI and share page
   - **Impact**: Medium - AI interaction improvement

5. **Tool Enhancements** (`5e777fd2`, `a760e836`)
   - Toggle tool details visibility
   - Placeholder on pending assistant messages
   - **Impact**: Low - UI polish

6. **Language Support** (`ee0519aa`, `1954b591`)
   - Added clangd for C++
   - ESLint LSP support
   - **Impact**: Medium - Developer experience

7. **Permission System** (`542186aa`)
   - Webfetch permission support
   - **Impact**: High - Security feature

### 🐛 Critical Bug Fixes (29 commits)
1. **Shell Integration** (`11861747`)
   - Fix bash hiding stdout from zshrc
   - **Priority**: High

2. **Permission System** (`832d8da4`)
   - Fix permission prompting issues
   - **Priority**: Critical

3. **Configuration** (`ed5f76d8`)
   - Better error messages for invalid config references
   - **Priority**: High

4. **File Operations** (`f2021a85`)
   - Allow attachments outside cwd, support SVG
   - **Priority**: Medium

5. **UI/UX Fixes** (`66d99ba5`, `ccaebdcd`, `c4ae3e42`)
   - Messages layout stability
   - Word wrapping improvements
   - Markdown list rendering
   - **Priority**: Medium

6. **VSCode Extension** (`3530885f`, `b2f2c9ac`)
   - Cursor placement fixes
   - Real vs virtual cursor handling
   - **Priority**: Medium

### 🔧 Infrastructure & Maintenance (15+ commits)
1. **Documentation** (`bedeb626`, `2e5fdd8c`, `21f15f15`)
   - Global model options docs
   - CLI documentation updates
   - **Priority**: Low

2. **Build & CI** (`a4beb60e`, `8ed72ae0`)
   - Rename bash → shell
   - Add OPENCODE env var
   - **Priority**: Low

3. **Dependencies & Compatibility** (`3f0f910f`)
   - Fix ERR_DLOPEN_FAILED error
   - **Priority**: Medium

## Migration Strategy

### Phase 1: Foundation & Critical Fixes (Week 1-2)
**Priority**: Critical
**Risk**: Low

1. **Permission System Updates**
   ```bash
   git cherry-pick 832d8da4  # Fix permission prompting
   git cherry-pick 542186aa  # Webfetch permissions
   ```

2. **Configuration Improvements**
   ```bash
   git cherry-pick ed5f76d8  # Better config error messages
   git cherry-pick 23757f3a  # Load first local/global rule file
   ```

3. **Core Bug Fixes**
   ```bash
   git cherry-pick 11861747  # Bash stdout fix
   git cherry-pick 3f0f910f  # ERR_DLOPEN_FAILED fix
   ```

### Phase 2: Shell/Bash Command Integration (Week 3-4)
**Priority**: High
**Risk**: Medium (potential conflicts with kuuzuki's custom bash handling)

1. **Analyze Conflicts**
   - Compare OpenCode's bash implementation with kuuzuki's existing bash tools
   - Identify integration points and potential conflicts

2. **Selective Integration**
   ```bash
   # Carefully review and adapt these commits:
   git show 1357319f  # feat: bash commands
   git show 93b71477  # support !shell commands
   git show e729eed3  # wip: bash
   ```

3. **Testing Strategy**
   - Test bash command execution in both TUI and CLI modes
   - Verify compatibility with existing kuuzuki bash tools
   - Ensure no regression in current functionality

### Phase 3: UI/UX Enhancements (Week 5-6)
**Priority**: Medium
**Risk**: Low

1. **File Attachment Improvements**
   ```bash
   git cherry-pick a4c14dbb  # Convert attachments to text
   git cherry-pick f2021a85  # Allow attachments outside cwd
   git cherry-pick 81a3e024  # Improve file pasting
   ```

2. **Session Management**
   ```bash
   git cherry-pick 47c32764  # Session rename functionality
   ```

3. **UI Polish**
   ```bash
   git cherry-pick 5e777fd2  # Toggle tool details
   git cherry-pick a760e836  # Pending message placeholder
   git cherry-pick b8d2aebf  # Thinking blocks rendering
   ```

### Phase 4: Language Support & Developer Experience (Week 7)
**Priority**: Medium
**Risk**: Low

1. **Language Server Integration**
   ```bash
   git cherry-pick ee0519aa  # Add clangd for C++
   git cherry-pick 1954b591  # ESLint LSP
   ```

2. **Documentation Updates**
   ```bash
   git cherry-pick 2e5fdd8c  # Global model options docs
   git cherry-pick 21f15f15  # CLI documentation
   ```

### Phase 5: Final Polish & Testing (Week 8)
**Priority**: Low
**Risk**: Low

1. **Remaining Bug Fixes**
   - Apply remaining UI/UX fixes
   - Update documentation
   - Final compatibility testing

2. **Version Alignment**
   - Update version numbers
   - Sync package.json dependencies
   - Update changelog

## Conflict Resolution Strategy

### High-Risk Areas
1. **Bash/Shell Integration**
   - **Conflict**: OpenCode's new bash commands vs kuuzuki's existing bash tool
   - **Resolution**: Merge functionality, prioritize kuuzuki's enhanced features
   - **Testing**: Comprehensive bash command testing

2. **Permission System**
   - **Conflict**: Permission handling differences
   - **Resolution**: Adopt OpenCode's improvements while preserving kuuzuki's security enhancements
   - **Testing**: Permission flow testing

3. **Configuration Management**
   - **Conflict**: Config file handling differences
   - **Resolution**: Merge improvements, maintain kuuzuki's .agentrc extensions
   - **Testing**: Config validation testing

### Merge Strategy
1. **Three-way merge** for compatible changes
2. **Manual resolution** for conflicting features
3. **Feature flags** for experimental functionality
4. **Rollback plan** for each phase

## Testing Protocol

### Automated Testing
```bash
# Run full test suite after each phase
bun test
./run.sh test

# Specific test categories
bun test packages/kuuzuki/test/session-*.test.ts  # Session management
bun test packages/kuuzuki/test/plugin-*.test.ts   # Plugin system
bun test test/tool-fallback.test.ts               # Tool fallback system
```

### Manual Testing Checklist
- [ ] TUI starts and responds correctly
- [ ] CLI commands execute properly (`run`, `serve`, etc.)
- [ ] Bash/shell commands work in both modes
- [ ] File attachment handling
- [ ] Permission system functionality
- [ ] Session management (create, rename, delete)
- [ ] AI integration with all providers
- [ ] Plugin system compatibility
- [ ] Configuration file loading

### Integration Testing
- [ ] NPM package installation
- [ ] Cross-platform compatibility (Linux, macOS, Windows)
- [ ] VSCode extension integration
- [ ] MCP server compatibility

## Timeline & Milestones

| Phase | Duration | Milestone | Deliverable |
|-------|----------|-----------|-------------|
| 1 | Week 1-2 | Critical fixes applied | Stable foundation |
| 2 | Week 3-4 | Bash integration complete | Enhanced shell support |
| 3 | Week 5-6 | UI/UX improvements merged | Better user experience |
| 4 | Week 7 | Language support added | Enhanced developer tools |
| 5 | Week 8 | Final testing & release | kuuzuki v0.2.0 |

## Risk Assessment

### High Risk
- **Bash command conflicts**: Potential breaking changes to existing functionality
- **Permission system changes**: Security implications
- **Configuration handling**: Backward compatibility

### Medium Risk
- **UI/UX changes**: Potential user experience disruption
- **File attachment handling**: Data integrity concerns
- **Language server integration**: Development environment impact

### Low Risk
- **Documentation updates**: Minimal impact
- **Minor bug fixes**: Isolated changes
- **Version number updates**: Administrative changes

## Success Criteria

### Technical Metrics
- [ ] All automated tests pass
- [ ] No regression in existing functionality
- [ ] Performance maintained or improved
- [ ] Memory usage within acceptable limits

### User Experience Metrics
- [ ] TUI responsiveness maintained
- [ ] CLI command compatibility preserved
- [ ] File operations work reliably
- [ ] Error messages are clear and helpful

### Integration Metrics
- [ ] NPM package installs successfully
- [ ] VSCode extension functions properly
- [ ] MCP servers remain compatible
- [ ] Cross-platform functionality verified

## Rollback Plan

### Phase-level Rollback
```bash
# Create backup branches before each phase
git checkout -b backup-phase-1
git checkout -b backup-phase-2
# etc.

# Rollback if issues arise
git checkout master
git reset --hard backup-phase-N
```

### Feature-level Rollback
- Maintain feature flags for new functionality
- Document specific commits for easy reversion
- Keep detailed change logs for each modification

## Communication Plan

### Internal Team
- Daily progress updates during active phases
- Weekly milestone reviews
- Immediate notification of blocking issues

### Community
- Progress updates in GitHub discussions
- Beta release for community testing
- Documentation updates for new features

## Post-Migration Tasks

1. **Version Release**
   - Update to kuuzuki v0.2.0
   - Comprehensive changelog
   - Migration guide for users

2. **Documentation**
   - Update README with new features
   - Refresh installation instructions
   - Update API documentation

3. **Community Engagement**
   - Announce parity completion
   - Gather user feedback
   - Plan next parity cycle

## Conclusion

This parity plan provides a structured approach to integrating 189 commits from OpenCode v0.4.2 to v0.4.45. The phased approach minimizes risk while ensuring comprehensive feature integration. The focus on testing and rollback procedures ensures kuuzuki maintains its stability and reliability throughout the migration process.

**Estimated Completion**: 8 weeks
**Risk Level**: Medium (manageable with proper testing)
**Expected Outcome**: kuuzuki v0.2.0 with full OpenCode v0.4.45 parity plus kuuzuki's unique enhancements