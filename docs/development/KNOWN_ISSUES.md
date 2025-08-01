# Known Issues

## Bun Namespace Error (v0.1.16)

### Issue
When running with Bun v1.2.19, the following error occurs:
```
error: Top-level return cannot be used inside an ECMAScript module
    at /home/moika/Documents/code/kuucode/packages/kuuzuki/src/session/index.ts:49:1
```

This error points to the `export namespace Session {` declaration, which is valid TypeScript but seems to trigger a bug in Bun.

### Comprehensive Analysis
- The code is syntactically correct and passes TypeScript validation
- The issue appears to be a Bun parser/transpiler bug with namespace handling
- No top-level return statements exist in the code
- **All Bun compilation modes affected**: runtime execution, bundling (`Bun.build()`), and standalone compilation (`--compile`)
- This is a fundamental issue in Bun's TypeScript namespace handling

### Tested Workarounds
1. ✅ **TypeScript Compilation**: Compiling with `tsc` and running with Node.js works
2. ❌ **Bun.build() API**: Still fails with same namespace error
3. ❌ **Bun CLI bundling**: Still fails with same namespace error  
4. ❌ **Bun --compile**: Still fails with same namespace error
5. ❌ **Custom plugins**: Cannot be applied due to bundler failure

### Current Solution
The TypeScript compilation approach is the only viable workaround:
1. Use `npm run build:tsc` to compile TypeScript to JavaScript
2. Run with Node.js or the compiled output via `bin/kuuzuki.js`

### Related Changes
This issue was discovered after simplifying the context management system in commit b86ebda8, which:
- Removed complex hybrid context management (12k+ lines)
- Implemented direct message loading similar to OpenCode
- Added security fixes for share secrets and ID validation