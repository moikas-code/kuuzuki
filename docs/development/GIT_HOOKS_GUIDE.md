# Git Hooks Guide for Kuuzuki

This guide explains the git hooks system in kuuzuki that helps prevent CI failures and maintains code quality.

## 🎯 Overview

Kuuzuki uses git hooks to catch common issues before they reach CI, saving time and preventing build failures. The hooks are stored in `.githooks/` and automatically configured during development setup.

## 🔧 Setup

### Automatic Setup (Recommended)
```bash
./scripts/setup-git-hooks.sh
```

### Manual Setup
```bash
git config core.hooksPath .githooks
chmod +x .githooks/*
```

## 📝 Pre-Commit Hook

The pre-commit hook runs before each commit and performs these checks:

### ✅ Checks Performed

1. **Lockfile Synchronization**
   - Ensures `bun.lock` is in sync with `package.json`
   - Automatically fixes and stages lockfile if needed
   - Prevents CI failures from frozen lockfile issues

2. **TypeScript Compilation**
   - Validates TypeScript code compiles without errors
   - Catches type errors before they reach CI
   - Runs in `packages/kuuzuki/`

3. **Go TUI Compilation**
   - Ensures Go code compiles successfully
   - Validates TUI binary can be built
   - Runs in `packages/tui/`

4. **Critical Tests**
   - Runs essential tests (tool fallback system)
   - Quick validation of core functionality
   - Times out after 30 seconds to avoid blocking commits

5. **Code Quality Checks**
   - Detects `console.log` in production code
   - Finds TODO/FIXME comments
   - Warns about potential issues

6. **Version Consistency**
   - Checks package.json versions are readable
   - Validates main package version

### 🚦 Hook Behavior

- **✅ Success**: All checks pass, commit proceeds
- **🔧 Auto-fix**: Issues fixed automatically (e.g., lockfile), commit blocked to review changes
- **❌ Failure**: Critical errors found, commit blocked until fixed

### 🆘 Emergency Bypass

If you need to commit despite hook failures (emergency only):
```bash
git commit --no-verify
```

## 🚀 Pre-Push Hook

The pre-push hook validates kuuzuki packages before version tag pushes:

### ✅ Triggers
- Only runs when pushing version tags (`kuuzuki-v*`)
- Validates package before release
- Prevents broken releases

### 🔍 Validation
- Runs full validation suite
- Times out after 60 seconds (GitKraken compatibility)
- Blocks push if validation fails

### 🆘 Emergency Bypass
```bash
git push --no-verify origin kuuzuki-v1.0.0
```

## 🛠️ Troubleshooting

### Hook Not Running
```bash
# Check hook configuration
git config core.hooksPath

# Should output: .githooks
```

### Permission Issues
```bash
# Make hooks executable
chmod +x .githooks/*
```

### TypeScript Errors
```bash
# Check specific errors
cd packages/kuuzuki
bun run typecheck
```

### Go Compilation Issues
```bash
# Check Go build
cd packages/tui
go build ./cmd/kuuzuki
```

### Lockfile Issues
```bash
# Manually sync lockfile
bun install
git add bun.lock
```

## 📊 Hook Performance

- **Pre-commit**: ~10-30 seconds (depending on tests)
- **Pre-push**: ~30-60 seconds (full validation)
- **Timeout protection**: Prevents infinite hangs

## 🔄 Maintenance

### Updating Hooks
1. Edit files in `.githooks/`
2. Test changes: `./.githooks/pre-commit`
3. Commit hook updates
4. Team members run `./scripts/setup-git-hooks.sh`

### Adding New Checks
1. Add check function to hook script
2. Call function in main execution
3. Update documentation
4. Test thoroughly

## 💡 Best Practices

### For Developers
- Let hooks run - they save time in the long run
- Fix issues locally rather than bypassing hooks
- Run `bun install` after dependency changes
- Test TypeScript changes before committing

### For Maintainers
- Keep hooks fast (< 30 seconds for pre-commit)
- Provide clear error messages
- Auto-fix when possible
- Document all checks

## 🎉 Benefits

- **Faster CI**: Fewer failed builds
- **Better Code Quality**: Catches issues early
- **Consistent Environment**: Same checks everywhere
- **Developer Experience**: Clear feedback on issues
- **Release Safety**: Validates packages before publishing

## 📚 Related Documentation

- [Development Setup](DEV_SETUP.md)
- [Testing Guide](../testing/)
- [CI/CD Pipeline](.github/workflows/)
- [Contributing Guidelines](../../CONTRIBUTING.md)
