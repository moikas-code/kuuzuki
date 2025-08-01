# Kuuzuki 0.1.7 Release Checklist

## ✅ Changes Made
- [x] Replaced keytar with pure JavaScript keychain implementation
- [x] Created npm distribution structure matching OpenCode
- [x] Built cross-platform launcher script
- [x] Set up GitHub Actions for multi-platform builds
- [x] Fixed billing.ts import issue
- [x] Added scripts for building and publishing
- [x] Cleaned up backup files
- [x] Updated version to 0.1.7

## 🔧 Known Issues to Fix
- [ ] Bun macro in models.ts - Added prepare-npm.ts script to handle this
- [ ] Test full npm install flow works correctly

## 📋 Pre-Release Checklist
- [ ] Run full test suite: `bun test`
- [ ] Test all commands work:
  - [ ] `./kuuzuki --version` shows 0.1.7
  - [ ] `./kuuzuki tui` launches correctly
  - [ ] `./kuuzuki serve` starts server
  - [ ] `./kuuzuki apikey` works
- [ ] Build distribution: `bun run scripts/build-distribution.ts`
- [ ] Test local install from tarballs
- [ ] Dry run publish: `bun run scripts/publish-all.ts --dry-run`

## 🚀 Release Steps
1. Ensure all tests pass
2. Commit all changes
3. Create git tag: `git tag v0.1.7`
4. Push tag: `git push origin v0.1.7`
5. Run publish script: `bun run scripts/publish-all.ts`
6. Verify on npm: https://www.npmjs.com/package/kuuzuki

## 📝 Release Notes
### v0.1.7
- **Breaking**: Removed keytar dependency for better cross-platform support
- **New**: Pure JavaScript credential storage using encryption
- **New**: Multi-package npm distribution (main + platform binaries)
- **New**: Cross-platform launcher script
- **Fixed**: Import issues preventing npm installation
- **Improved**: Build and publish workflow

### Installation
```bash
npm install -g kuuzuki
```

### Platform Support
- Linux x64 ✅
- Linux ARM64 (requires build)
- macOS x64 (requires build)
- macOS ARM64 (requires build)  
- Windows x64 (requires build)