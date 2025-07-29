# Hybrid Context Toggle Command

The hybrid context feature can now be toggled on/off during runtime in the kuuzuki TUI.

## Usage

### Slash Command

Type `/hybrid` in the input field and press Enter.

### Keybinding

Press `Ctrl+X` (leader key) followed by `b`.

## Behavior

When toggled:

1. A toast notification shows the new state (enabled/disabled)
2. The preference is saved to `~/.local/state/kuuzuki/tui`
3. The setting applies to all **new** sessions
4. Current session continues with its initial setting

## Environment Variable

The toggle modifies the `KUUZUKI_HYBRID_CONTEXT_ENABLED` environment variable:

- `true` or `1` = enabled
- `false` or `0` = disabled
- Not set = defaults to enabled

## Persistence

The setting persists across kuuzuki restarts via the state file.

## Testing

To verify the current state:

```bash
cat ~/.local/state/kuuzuki/tui | grep hybrid_context_enabled
```

## Implementation Details

- Command name: `hybrid_context_toggle`
- Default state: Enabled
- Affects: Message compression and context management in AI conversations
- Performance: Reduces token usage by 50-80% when enabled
