# Phase 1: OpenCode Parity Cleanup - Complete Implementation

## Overview

Phase 1 of the OpenCode parity restoration strategy focused on removing kuuzuki-specific commands and features that deviated from the original OpenCode architecture. This phase successfully reduced the command surface area from 22 commands to 13 commands, bringing kuuzuki closer to its OpenCode foundation.

**Implementation Date**: January 2025  
**Status**: ✅ Complete  
**Command Reduction**: 22 → 13 commands (41% reduction)

## Objectives Achieved

1. **Remove hybrid command system** - Eliminated dual CLI/TUI command paradigm
2. **Remove debug commands** - Removed 6 debugging subcommands
3. **Remove development-specific commands** - Cleaned up tui-dev and schema commands
4. **Clean up documentation** - Removed references to removed features
5. **Maintain core functionality** - Preserved essential OpenCode-compatible commands

## Commands Removed

### 1. Hybrid Command (`hybrid`)

**Files Deleted:**
- `packages/kuuzuki/src/cli/cmd/hybrid.ts`
- `docs/HYBRID_CONTEXT.md`
- `docs/HYBRID_CONTEXT_TOGGLE.md` 
- `docs/hybrid-command-usage.md`
- `test-hybrid-context-scenarios.sh`
- `test-hybrid-context-toggle.sh`
- `test-hybrid-toggle.sh`
- `packages/kuuzuki/test/hybrid-context.test.ts`

**Knowledge Base Cleanup:**
- `kb/hybrid-context-implementation-plan.md`
- `kb/hybrid-context-implementation-progress.md`
- `kb/hybrid-context-roadmap.md`

**Rationale:**
The hybrid command created a complex dual-mode system where commands could run in both CLI and TUI contexts. This was a kuuzuki-specific innovation that deviated from OpenCode's simpler architecture. The complexity added maintenance overhead without clear benefits over the standard TUI mode.

### 2. Debug Commands (`debug`)

**Files Deleted:**
- `packages/kuuzuki/src/cli/cmd/debug/index.ts` (main debug command)
- `packages/kuuzuki/src/cli/cmd/debug/file.ts` (file system debugging)
- `packages/kuuzuki/src/cli/cmd/debug/lsp.ts` (LSP server debugging)
- `packages/kuuzuki/src/cli/cmd/debug/ripgrep.ts` (search debugging)
- `packages/kuuzuki/src/cli/cmd/debug/scrap.ts` (scraping debugging)
- `packages/kuuzuki/src/cli/cmd/debug/snapshot.ts` (snapshot debugging)

**Rationale:**
The debug command suite was kuuzuki-specific and not present in OpenCode. While useful for development, these commands:
- Added complexity to the CLI surface
- Were primarily developer-focused rather than user-focused
- Could be replaced with standard debugging approaches
- Diverted from OpenCode's cleaner command structure

### 3. Development Commands

**Files Deleted:**
- `packages/kuuzuki/src/cli/cmd/tui-dev.ts` (development TUI variant)
- `packages/kuuzuki/src/cli/cmd/schema.ts` (schema generation)

**Rationale:**
These were development-specific commands that shouldn't be exposed to end users:
- `tui-dev`: Development variant of TUI with additional debugging features
- `schema`: Tool for generating configuration schemas

## Files Modified

### Core CLI Structure
- `packages/kuuzuki/src/index.ts` - Removed command registrations
- `packages/kuuzuki/src/config/schema.ts` - Cleaned up hybrid-related configs

### Session Management
- `packages/kuuzuki/src/session/index.ts` - Removed hybrid session handling
- `packages/kuuzuki/src/session/persistence.ts` - Simplified session persistence

### TUI Components
- `packages/tui/internal/app/app.go` - Removed hybrid mode support
- `packages/tui/internal/app/state.go` - Cleaned up state management
- `packages/tui/internal/commands/command.go` - Simplified command routing
- `packages/tui/internal/tui/tui.go` - Removed hybrid UI elements

### Documentation
- `packages/web/src/content/docs/docs/cli.mdx` - Updated CLI reference
- `kb/cli-documentation-improvement-plan.md` - Updated with Phase 1 changes

## Commands Remaining (13 Total)

### Core Commands (5)
1. `tui` - Terminal UI mode
2. `run` - Execute single commands
3. `serve` - Start HTTP server
4. `stats` - Usage statistics
5. `models` - List available models

### Authentication (4)
6. `auth` - Authentication management
7. `auth login` - Login to providers
8. `auth list` - List configured providers
9. `auth logout` - Logout from providers

### GitHub Integration (3)
10. `github` - GitHub integration
11. `github install` - Install GitHub app
12. `github run` - Run GitHub workflows


### Extensions (2)
18. `mcp` - MCP server management
19. `mcp add` - Add MCP servers

### Agent System (1)
20. `agent` - Agent management

## Impact Assessment

### Positive Impacts
- **Reduced Complexity**: 41% reduction in command surface area
- **Better OpenCode Alignment**: Closer to original architecture
- **Cleaner Codebase**: Removed 15+ files and associated documentation
- **Simplified Maintenance**: Fewer code paths to maintain and test
- **Clearer Purpose**: Focus on core terminal AI assistant functionality

### Minimal Negative Impact
- **Debug Capabilities**: Removed specialized debugging tools (can use standard approaches)
- **Hybrid Mode**: Some users may have preferred CLI/TUI dual mode (TUI mode remains fully functional)

### No Impact On
- **Core Functionality**: TUI, server, and run modes fully preserved
- **AI Integration**: All AI providers and models remain available
- **Tool System**: All tools and integrations remain functional
- **GitHub Integration**: Full GitHub app and workflow support maintained
- **MCP Support**: Model Context Protocol integration unchanged

## Technical Details

### Session Management Simplification
The removal of hybrid mode allowed significant simplification in session management:
- Eliminated dual session contexts
- Simplified persistence layer
- Reduced state management complexity
- Cleaner error handling paths

### TUI Improvements
With hybrid mode removed, the TUI became more focused:
- Removed mode-switching logic
- Simplified command routing
- Cleaner UI state management
- Better keyboard handling focus

### Configuration Cleanup
- Removed hybrid-specific configuration options
- Simplified schema definitions
- Cleaner validation logic
- Reduced configuration complexity

## Verification & Testing

### Manual Testing Completed
- ✅ TUI starts and functions correctly
- ✅ All remaining 13 commands execute properly
- ✅ Server mode handles requests correctly
- ✅ GitHub integration works as expected
- ✅ MCP servers can be added and used
- ✅ Authentication flows work properly

### Build Verification
- ✅ TypeScript compilation succeeds
- ✅ Go TUI builds without errors
- ✅ No broken imports or references
- ✅ All tests pass (after test cleanup)

## Next Phases

### Phase 2: OpenCode Feature Parity (Planned)
- Compare remaining commands with OpenCode
- Identify any missing core functionality
- Implement any missing essential features
- Further command consolidation if needed

### Phase 3: Architecture Alignment (Planned)
- Review internal architecture vs OpenCode
- Align folder structure and patterns
- Ensure consistent naming conventions
- Optimize for OpenCode compatibility

## Lessons Learned

1. **Command Proliferation Risk**: Easy to add commands, harder to remove them
2. **Documentation Importance**: Thorough cleanup prevents confusion
3. **Testing Coverage**: Comprehensive testing essential for safe removal
4. **User Impact**: Most removed features had minimal user impact
5. **Code Quality**: Removal improved overall code quality and maintainability

## Files for Reference

### Key Remaining Command Files
- `packages/kuuzuki/src/cli/cmd/tui.ts` - Core TUI command
- `packages/kuuzuki/src/cli/cmd/run.ts` - Single command execution
- `packages/kuuzuki/src/cli/cmd/serve.ts` - Server mode
- `packages/kuuzuki/src/cli/cmd/github.ts` - GitHub integration
- `packages/kuuzuki/src/cli/cmd/auth.ts` - Authentication
- `packages/kuuzuki/src/cli/cmd/mcp.ts` - MCP integration
- `packages/kuuzuki/src/cli/cmd/agent.ts` - Agent system

### Configuration
- `packages/kuuzuki/src/config/schema.ts` - Simplified configuration schema
- `packages/kuuzuki/src/index.ts` - Main CLI entry point

### Documentation
- `packages/web/src/content/docs/docs/cli.mdx` - Updated CLI documentation

## Success Metrics

- ✅ **Command Reduction**: 22 → 13 commands (41% reduction achieved)
- ✅ **File Cleanup**: 15+ files removed successfully
- ✅ **Documentation Sync**: All docs updated to reflect changes
- ✅ **Functionality Preservation**: Core features remain intact
- ✅ **Build Success**: All components build without errors
- ✅ **Test Coverage**: All remaining functionality tested

## Conclusion

Phase 1 successfully achieved its objective of cleaning up kuuzuki-specific additions and bringing the project closer to OpenCode parity. The 41% reduction in command surface area, combined with significant code cleanup, has resulted in a more maintainable and focused codebase that aligns better with the original OpenCode vision.

The project now has a cleaner foundation for future development and is ready for Phase 2 activities focused on ensuring complete feature parity with OpenCode's core functionality.

## Post-Phase 1 Update: Phase 2 Completed

**Update Date**: January 31, 2025  
**Status**: Phase 2 Complete ✅

Following Phase 1, **Phase 2** was executed to further streamline the codebase by removing the git-permissions system and related complexity. This resulted in additional command reduction and code cleanup:

### Phase 2 Achievements
- **Additional Command Reduction**: 13 → 8 effective commands (removing git-permissions variants)
- **Code Cleanup**: ~1000+ lines of git-permissions code removed
- **Simplified Architecture**: Removed complex git permission system
- **Better OpenCode Alignment**: Much closer to OpenCode's 11 commands

### Phase 2 Impact
- **Command Structure**: Now very close to OpenCode parity with 8 core commands vs OpenCode's 11
- **Codebase Quality**: Significant reduction in complexity and maintenance burden
- **User Experience**: Simplified interface without complex git permission management
- **Development Focus**: Clear path forward for Phase 3 architecture alignment

**Combined Result**: Phase 1 + Phase 2 achieved 64% command reduction (22 → 8 effective commands) while maintaining all essential functionality and moving significantly closer to OpenCode parity.