# Provider Models Crash Fix

## Issue
Application was crashing on startup with error:
```
ERROR service=default name=TypeError message=undefined is not an object (evaluating 'provider.models') fatal
```

## Root Cause
In `src/provider/provider.ts`, the `anthropic` custom loader was accessing `provider.models` without checking if it exists first, while other loaders like `github-copilot` had proper defensive checks.

## Fix Applied
Added defensive check before accessing `provider.models` in the anthropic loader:

```typescript
// Before (line 32):
for (const model of Object.values(provider.models)) {
  model.cost = {
    input: 0,
    output: 0,
  }
}

// After:
if (provider && provider.models) {
  for (const model of Object.values(provider.models)) {
    model.cost = {
      input: 0,
      output: 0,
    }
  }
}
```

## Verification
- ✅ Server starts without errors
- ✅ TypeScript compilation passes
- ✅ No regression in functionality

## Additional Notes
This defensive programming pattern should be applied consistently across all provider loaders to prevent similar issues. The github-copilot loader already had this check, which served as the pattern for this fix.

---
*Fixed: 2025-08-09*
*Severity: Critical (prevented application startup)*