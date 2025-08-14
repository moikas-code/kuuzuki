# TypeScript Fixes Detailed Plan for v0.1.1

## Overview
Detailed breakdown of TypeScript errors that need fixing for v0.1.1 release.

## Error Categories

### 1. Unknown Type Errors (41 instances)
These occur when TypeScript can't infer types from dynamic operations.

#### Pattern 1: Agent/Mode Configuration
```typescript
// Current (error)
if (value.type === "agent") { /* value is unknown */ }

// Fix
if ((value as any).type === "agent") { /* temporary fix */ }
// Or better: Define proper types
interface ConfigValue {
  type: string;
  // ... other properties
}
```

#### Pattern 2: JSON Response Handling
```typescript
// Current (error)
const json = await response.json()
return json.access_token // json is unknown

// Fix
interface TokenResponse {
  access_token: string;
  // ... other fields
}
const json = await response.json() as TokenResponse
```

### 2. Missing Properties on Event Types
Location: `src/session/integration.ts`

```typescript
// Current (error)
event.info // Property 'info' does not exist

// Fix: Update event type definitions
interface SessionEvent {
  type: string;
  properties: {
    info?: SessionInfo;
    sessionID?: string;
  }
}
```

### 3. Library Compatibility Issues

#### findLast Method (ES2023)
```typescript
// Current (error)
messages.findLast(x => x.type === "patch")

// Fix: Add polyfill or change target
// Option 1: Update tsconfig lib to include ES2023
"lib": ["es2023"]

// Option 2: Use alternative
messages.slice().reverse().find(x => x.type === "patch")
```

#### import.meta Usage
```typescript
// Current (error)
import.meta.url // Not allowed in CommonJS

// Fix: Use __dirname or configure module
const import_meta_url = require('url').pathToFileURL(__filename).href
```

### 4. Module Resolution Issues

#### @openauthjs/openauth/pkce
```typescript
// Current (error)
import { createCodeChallenge } from "@openauthjs/openauth/pkce"

// Fix: Update moduleResolution
"moduleResolution": "bundler" // or "node16"
```

### 5. Type Assertion Fixes

#### Config Defaults
```typescript
// Current (error)
const config = {} // Missing required properties

// Fix: Provide full default
const config: Config = {
  version: "1.0.0",
  theme: "default",
  share: "manual",
  autoupdate: true,
  subscriptionRequired: false,
  disabled_providers: [],
  $schema: "",
  keybinds: defaultKeybinds,
  // ... other required fields
}
```

## Systematic Fix Approach

### Phase 1: Critical Path (2-3 hours)
Fix errors preventing compilation:
1. Unknown type assertions in core files
2. Module resolution in tsconfig
3. Missing required properties

### Phase 2: Type Safety (2-3 hours)
Add proper types instead of workarounds:
1. Define interfaces for all event types
2. Create type guards for runtime checks
3. Add response type definitions

### Phase 3: Test Updates (1-2 hours)
Fix test-specific issues:
1. Update property access syntax
2. Fix mock type definitions
3. Align test configs with new types

## Quick Wins

### 1. Update tsconfig.json
```json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2023"],
    "module": "commonjs",
    "moduleResolution": "node16",
    "skipLibCheck": true,
    "allowJs": true,
    "strict": false, // Temporarily disable for migration
    "esModuleInterop": true
  }
}
```

### 2. Add Type Assertion Helper
```typescript
// utils/types.ts
export function assertType<T>(value: unknown): T {
  return value as T;
}
```

### 3. Common Type Definitions
```typescript
// types/common.ts
export interface UnknownObject {
  [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}
```

## Testing Strategy

### 1. Incremental Compilation
```bash
# Test compilation after each major fix
npx tsc --noEmit

# Count remaining errors
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

### 2. Runtime Testing
- Start with core functionality
- Test each subsystem after fixes
- Ensure no runtime type errors

### 3. Build Verification
```bash
# Full build test
npm run build

# Package test
npm pack
tar -tzf kuuzuki-*.tgz | grep -E "dist/.*\.js$"
```

## Priority Order

1. **Block 1**: Core compilation (prevents any build)
   - Module resolution
   - Logger exports
   - Config defaults

2. **Block 2**: Feature functionality
   - Session events
   - Provider types
   - Tool execution

3. **Block 3**: Polish and tests
   - Test file fixes
   - Unused imports
   - Strict null checks

## Rollback Plan
If fixes introduce breaking changes:
1. Keep v0.1.0 Bun approach as fallback
2. Document known issues
3. Provide migration guide

---
Created: 2025-07-30
Related: v0.1.1-release-plan.md
Status: Planning