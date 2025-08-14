# Fish Shell Support Implementation

## Overview

Kuuzuki now includes comprehensive fish shell support based on OpenCode commit 4dea0209. This ensures compatibility with fish shell users by properly handling shell-specific argument patterns.

## Implementation Details

### Shell Detection

The implementation detects fish shell by checking if the `SHELL` environment variable contains "fish":

```typescript
const shell = process.env["SHELL"] ?? "bash"
const isFish = shell.includes("fish")
```

### Argument Handling

Fish shell requires different arguments compared to other shells:

- **Fish shell**: `["-c", script]` (no `-l` flag)
- **Other shells**: `["-c", "-l", script]` (with `-l` flag)

```typescript
const args = isFish
  ? ["-c", script] // fish with just -c
  : ["-c", "-l", script]
```

### Implementation Location

The fish shell support is implemented in:
- `packages/kuuzuki/src/session/index.ts` (lines 4174-4178)

## Supported Fish Shell Paths

The implementation supports various fish shell installation paths:
- `/usr/bin/fish`
- `/usr/local/bin/fish`
- `/opt/homebrew/bin/fish`
- `/bin/fish`
- `fish`

## Testing

Comprehensive tests verify fish shell compatibility:

### Test Files
- `test/fish-shell-support.test.ts` - Basic fish shell detection and argument generation
- `test/fish-shell-integration.test.ts` - Integration testing with environment simulation

### Test Coverage
- ✅ Fish shell detection from various paths
- ✅ Correct argument generation for fish vs other shells
- ✅ Environment variable handling
- ✅ Default fallback to bash when SHELL is not set
- ✅ Complex script handling
- ✅ Edge case handling

## Verification

All tests pass successfully:
```bash
bun test test/fish-shell-support.test.ts
# 5 pass, 0 fail, 18 expect() calls

bun test test/fish-shell-integration.test.ts  
# 7 pass, 0 fail, 28 expect() calls
```

## Compatibility

This implementation ensures 100% compatibility with:
- Fish shell users
- Existing bash/zsh users
- OpenCode's fish shell handling (commit 4dea0209)

## Usage

No user action required - fish shell support is automatically detected and handled when:
1. User has fish shell set as their default shell (`SHELL=/usr/bin/fish`)
2. Commands are executed through kuuzuki's session system
3. Shell scripts are spawned via the session handler

The implementation is transparent to users and maintains backward compatibility with all existing shell environments.