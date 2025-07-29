# TUI Dialog Fix Implementation Plan

## Overview

This document outlines the implementation plan to fix the broken overlay dialogs in kuuzuki's TUI that corrupt the display when appearing during chat interactions. This is a critical UX issue for the 0.1.0 release.

## Problem Statement

When the TUI attempts to show modal dialogs during chat interactions, the overlay system breaks the display by:
- Corrupting the chat input area
- Shifting UI elements out of place
- Making the interface unusable until restart

Affected interactions:
- Tool approval requests
- Yes/no confirmations during chat
- Text input requests from the AI

## Root Cause Analysis

The modal overlay system uses `PlaceOverlay` to render dialogs on top of the main layout. During active chat sessions, this conflicts with:
- The chat input area positioning
- The message rendering area
- The overall layout calculations

The current modal system was designed for non-chat UI elements (help, settings, etc.) and doesn't account for the dynamic nature of chat interactions.

## Solution Approach for 0.1.0

### Minimal Fix Strategy

For the 0.1.0 release, implement a minimal fix that:
1. **Disables modal overlays during active chat sessions**
2. **Uses inline message types for all chat interactions**
3. **Preserves modals for non-chat UI elements**

This approach:
- ✅ Fixes the immediate user issue
- ✅ Minimizes risk of breaking other features
- ✅ Can be implemented quickly
- ✅ Leaves room for proper refactoring later

## Implementation Steps

### Step 1: Add Active Chat Detection

Add a method to detect if the user is in an active chat session:

```go
// In tui.go
func (a *Model) hasActiveChat() bool {
    // Check if we have an active session and are in chat mode
    return a.app != nil && a.app.Session.ID != "" && 
           (a.activeConfirmation != nil || a.activeToolApproval != nil || 
            a.activeTextInput != nil || a.messages.HasMessages())
}
```

### Step 2: Modify Modal Rendering

Update the View() method to conditionally render modals:

```go
// In tui.go View() method, around line 666
if a.modal != nil && !a.hasActiveChat() {
    mainLayout = a.modal.Render(mainLayout)
}
```

### Step 3: Ensure Inline Messages are Used

Verify that all chat interactions use the inline message system:

1. **Tool Approvals**: Already implemented in `tool_approval.go`
2. **Confirmations**: Already implemented in `confirmation.go`
3. **Text Input**: Already implemented in `text_input.go`

### Step 4: Add Safety Checks

Add defensive checks to prevent modal creation during chat:

```go
// When creating modals, check chat state
if a.hasActiveChat() {
    // Log warning and skip modal creation
    slog.Warn("Attempted to create modal during active chat")
    return a, nil
}
```

### Step 5: Update Event Handlers

Ensure all permission/approval events route to inline messages:

```go
case opencode.EventListResponseEventPermissionUpdated:
    // Always use inline message, never modal
    cmds = append(cmds, func() tea.Msg {
        return chat.ToolApprovalMsg{
            ID:          msg.Properties.ID,
            ToolName:    msg.Properties.Title,
            Description: "Permission requested",
            Metadata:    msg.Properties.Metadata,
        }
    })
```

## Testing Plan

### Manual Testing Checklist

1. **Tool Approval Flow**:
   - [ ] Start kuuzuki TUI
   - [ ] Use a tool that requires approval
   - [ ] Verify inline approval message appears
   - [ ] Verify no overlay corruption
   - [ ] Test approve/deny functionality

2. **Yes/No Questions**:
   - [ ] Trigger a yes/no question during chat
   - [ ] Verify inline confirmation appears
   - [ ] Verify keyboard navigation works
   - [ ] Verify no visual corruption

3. **Text Input Requests**:
   - [ ] Trigger a text input request
   - [ ] Verify inline input field appears
   - [ ] Test typing and submission
   - [ ] Verify no overlay issues

4. **Non-Chat Modals**:
   - [ ] Open help dialog (outside chat)
   - [ ] Open settings/models dialog
   - [ ] Verify these still work correctly

### Automated Testing

Create test cases for:
- `hasActiveChat()` method logic
- Modal rendering conditions
- Inline message rendering
- Event routing logic

## Rollback Plan

If issues arise:

1. **Quick Revert**: Remove the `hasActiveChat()` check
2. **Feature Flag**: Add environment variable to disable fix
3. **Fallback**: Document workaround for users

## Future Improvements (0.2.0+)

### Architectural Refactoring

1. **InteractionManager**: Centralized system for all user interactions
2. **Event Bus**: Proper event routing for chat interactions
3. **Dialog API**: Unified API for all dialog types
4. **Context Awareness**: Smarter dialog positioning

### Enhanced Features

1. **Stacked Dialogs**: Support multiple pending interactions
2. **Priority System**: Handle urgent vs. non-urgent dialogs
3. **Persistence**: Remember unanswered questions
4. **Customization**: User preferences for interaction style

## Success Criteria

### For 0.1.0 Release

- [ ] No overlay corruption during chat interactions
- [ ] All chat interactions use inline messages
- [ ] Non-chat modals continue to work
- [ ] No performance regression
- [ ] Clear error messages if issues occur

### User Experience

- [ ] Smooth chat interaction flow
- [ ] Clear visual hierarchy
- [ ] Intuitive keyboard navigation
- [ ] No surprising behavior changes

## Risk Assessment

### Low Risk

- Conditional rendering based on state
- Preserves existing functionality
- Easy to revert if needed

### Mitigations

- Thorough testing before release
- Clear documentation of changes
- Monitor user feedback closely

## Timeline

- **Implementation**: 2-4 hours
- **Testing**: 2-3 hours
- **Documentation**: 1 hour
- **Total**: ~1 day

## Conclusion

This minimal fix addresses the critical UX issue while maintaining stability for the 0.1.0 release. The approach is pragmatic, safe, and leaves room for proper architectural improvements in future releases.

The inline message system already implemented provides a good foundation for chat interactions, and disabling overlays during chat is the simplest way to prevent corruption without major refactoring.