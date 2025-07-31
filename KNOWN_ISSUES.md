# Known Issues

## Bun Namespace Error (v0.1.16)

### Issue
When running with Bun v1.2.19, the following error occurs:
```
error: Top-level return cannot be used inside an ECMAScript module
    at /home/moika/Documents/code/kuucode/packages/kuuzuki/src/session/index.ts:49:1
```

This error points to the `export namespace Session {` declaration, which is valid TypeScript but seems to trigger a bug in Bun.

### Status
- The code is syntactically correct and passes TypeScript validation
- The issue appears to be a Bun runtime bug with namespace handling
- No top-level return statements exist in the code

### Workaround
Until this Bun issue is resolved, consider:
1. Using an older version of Bun
2. Compiling with TypeScript first, then running the compiled output
3. Refactoring from namespace to modern ES modules (major change)

### Related Changes
This issue was discovered after simplifying the context management system in commit b86ebda8, which:
- Removed complex hybrid context management (12k+ lines)
- Implemented direct message loading similar to OpenCode
- Added security fixes for share secrets and ID validation