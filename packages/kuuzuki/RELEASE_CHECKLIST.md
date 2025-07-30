# Kuuzuki Release Checklist

This checklist ensures we don't publish broken npm packages. Run through this before creating a version tag.

## Pre-Release Validation

### 1. 🔍 Run Automated Validation
```bash
cd packages/kuuzuki
npm run validate
```

This checks:
- ✅ package.json validity
- ✅ No catalog: dependencies
- ✅ All scripts are CommonJS
- ✅ Bin script executes without crash
- ✅ npm pack includes required files

### 2. 🧪 Manual Testing

#### Test Local Installation
```bash
# In packages/kuuzuki
npm pack
npm install -g kuuzuki-*.tgz

# Test the commands
kuuzuki --help        # Should show v0.1.x message
kuuzuki tui          # Should attempt to start (connection error is OK)
kuuzuki run          # Should show v0.1.x message

# Cleanup
npm uninstall -g kuuzuki
rm kuuzuki-*.tgz
```

#### Verify Binary Execution
```bash
# Test that the bin script works
node bin/kuuzuki.js --help
node bin/kuuzuki.js tui
```

### 3. 📋 Pre-Flight Checks

- [ ] Version bumped in package.json
- [ ] All tests pass: `bun test`
- [ ] No TypeScript errors (for now, we're using Bun runtime)
- [ ] Changelog updated (if applicable)
- [ ] Previous version's issues are fixed

### 4. 🏷️ Creating the Release

```bash
# Commit all changes
git add -A
git commit -m "chore: prepare release v0.1.X"

# Create and push tag
git tag kuuzuki-v0.1.X
git push origin master
git push origin kuuzuki-v0.1.X
```

### 5. 📦 Post-Release Verification

After GitHub Actions completes:

```bash
# Wait 5 minutes for npm to update
npm view kuuzuki versions --json

# Test installation from npm
npm install -g kuuzuki@latest
kuuzuki --help

# Verify it's the correct version
kuuzuki --version  # When implemented
```

## Common Issues to Check

### ❌ "catalog:" Dependencies
- Run `node scripts/fix-catalog-deps.js` before publishing
- Check all dependencies resolve to actual versions

### ❌ ESM/CommonJS Conflicts
- Ensure package.json doesn't have `"type": "module"`
- All scripts should use `require()` not `import`

### ❌ Missing Environment Variables
- TUI binary needs: KUUZUKI_SERVER, KUUZUKI_APP_INFO, KUUZUKI_MODES
- These are now provided by bin/kuuzuki.js

### ❌ Binary Not Found
- Ensure prepublish script builds all platform binaries
- Check that binaries/ is included in package.json "files"

### ❌ Workflow Failures
- Check NODE_AUTH_TOKEN is set in GitHub secrets
- Ensure workflow doesn't try to create files that already exist

## Emergency Fixes

If a broken version is published:

1. **Deprecate the broken version:**
   ```bash
   npm deprecate kuuzuki@0.1.X "Contains critical bug - use 0.1.Y instead"
   ```

2. **Publish a patch immediately:**
   - Fix the issue
   - Bump patch version
   - Run full validation
   - Push new tag

## Git Hooks Setup

To enable automatic validation on tag push:

```bash
# Set git to use our hooks directory
git config core.hooksPath .githooks
```

This will run validation automatically when pushing version tags.