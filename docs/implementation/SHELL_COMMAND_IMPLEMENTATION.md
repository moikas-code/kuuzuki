# !Shell Command Support Implementation

## Overview

Successfully implemented the critical !shell command support feature from OpenCode commits 1357319f and 93b71477. This allows users to type commands starting with `!` to execute shell commands directly in the TUI with real-time output streaming.

## Implementation Details

### 1. Input Detection (editor.go)

**File**: `packages/tui/internal/components/chat/editor.go`

**Changes**:
- Modified `Submit()` method to detect input starting with `!`
- Added shell command parsing and validation
- Triggers `ExecuteShellCommand` message instead of regular prompt

```go
// Check for !shell command
if strings.HasPrefix(value, "!") && len(value) > 1 {
    command := strings.TrimSpace(value[1:]) // Remove the ! prefix
    if command != "" {
        var cmds []tea.Cmd
        
        // Clear the editor
        updated, cmd := m.Clear()
        m = updated.(*editorComponent)
        cmds = append(cmds, cmd)
        
        // Execute shell command
        cmds = append(cmds, util.CmdHandler(app.ExecuteShellCommand{
            SessionID: m.app.Session.ID,
            Command:   command,
        }))
        return m, tea.Batch(cmds...)
    }
}
```

### 2. Message Type Definition (app.go)

**File**: `packages/tui/internal/app/app.go`

**Changes**:
- Added `ExecuteShellCommand` message type
- Added `ExecuteShellCommand()` method to App struct
- Integrates with existing `/session/:id/shell` endpoint

```go
type ExecuteShellCommand struct {
    SessionID string
    Command   string
}

func (a *App) ExecuteShellCommand(ctx context.Context, sessionID string, command string) (*opencode.AssistantMessage, error) {
    response, err := a.Client.Session.Shell(ctx, sessionID, opencode.SessionShellParams{
        Command: opencode.F(command),
    })
    if err != nil {
        slog.Error("Failed to execute shell command", "error", err, "command", command)
        return nil, err
    }
    return response, nil
}
```

### 3. Go SDK Integration (session.go)

**File**: `packages/sdk/go/session.go`

**Changes**:
- Added `Shell()` method to SessionService
- Added `SessionShellParams` type for command parameter
- Follows existing SDK patterns for API calls

```go
// Run a shell command
func (r *SessionService) Shell(ctx context.Context, id string, body SessionShellParams, opts ...option.RequestOption) (res *AssistantMessage, err error) {
    opts = append(r.Options[:], opts...)
    if id == "" {
        err = errors.New("missing required id parameter")
        return
    }
    path := fmt.Sprintf("session/%s/shell", id)
    err = requestconfig.ExecuteNewRequest(ctx, http.MethodPost, path, body, &res, opts...)
    return
}

type SessionShellParams struct {
    Command param.Field[string] `json:"command,required"`
}
```

### 4. TUI Integration (tui.go)

**File**: `packages/tui/internal/tui/tui.go`

**Changes**:
- Added handling for `ExecuteShellCommand` message in main Update loop
- Executes shell commands asynchronously
- Provides error feedback via toast notifications

```go
case app.ExecuteShellCommand:
    a.showCompletionDialog = false
    // Execute shell command asynchronously
    cmds = append(cmds, func() tea.Msg {
        _, err := a.app.ExecuteShellCommand(context.Background(), msg.SessionID, msg.Command)
        if err != nil {
            return toast.NewErrorToast(fmt.Sprintf("Shell command failed: %v", err))
        }
        return nil
    })
```

### 5. User Experience Enhancements (editor.go)

**Changes**:
- Added visual hint showing `!cmd shell` in the editor status bar
- Maintains existing UX patterns and styling

```go
hint := base(m.getSubmitKeyText()) + muted(" send   ") + muted("!cmd") + muted(" shell")
```

## Key Features

✅ **Input Detection**: Detects commands starting with `!` in TUI editor  
✅ **Command Parsing**: Strips `!` prefix and extracts shell command  
✅ **Shell Execution**: Executes commands via existing `/session/:id/shell` endpoint  
✅ **Real-time Integration**: Integrates with existing message streaming system  
✅ **Error Handling**: Provides user feedback for command failures  
✅ **Visual Feedback**: Shows `!cmd shell` hint in editor status bar  
✅ **Async Execution**: Commands execute asynchronously without blocking UI  
✅ **SDK Integration**: Complete Go SDK support for shell endpoint  

## Integration Points

1. **Existing Shell Endpoint**: Uses the already implemented `/session/:id/shell` endpoint
2. **Message System**: Integrates with existing message streaming and display
3. **Error Handling**: Uses existing toast notification system
4. **UI Patterns**: Follows existing TUI patterns and styling
5. **SDK Consistency**: Go SDK methods follow existing patterns

## Usage

Users can now execute shell commands directly in the TUI:

1. Type `!` followed by any shell command: `!ls -la`
2. Press Enter to execute
3. The command output appears in real-time in the chat
4. Error messages show as toast notifications if commands fail

## Examples

```bash
!ls -la                    # List files with details
!pwd                       # Show current directory
!git status                # Check git status
!npm install               # Install dependencies
!docker ps                 # List running containers
!grep -r "pattern" .       # Search for patterns
```

## Error Handling

- Invalid commands show error toasts
- Empty commands after `!` are ignored
- Network errors are handled gracefully
- Shell command failures are reported to the user

## Security Considerations

- Uses existing shell endpoint security measures
- Commands execute in the same security context as the bash tool
- No additional privilege escalation
- Follows existing permission patterns

## Testing

The implementation has been successfully built and is ready for testing:

1. Build completed without errors
2. All Go types and methods properly defined
3. Integration points correctly implemented
4. Error handling paths validated

## Architecture Benefits

1. **Minimal Changes**: Leverages existing infrastructure
2. **Consistent UX**: Follows established patterns
3. **Real-time Output**: Uses existing streaming system
4. **Error Resilience**: Comprehensive error handling
5. **SDK Complete**: Full Go SDK support

This implementation provides a seamless inline shell execution experience that matches the OpenCode feature while maintaining kuuzuki's architecture and security model.