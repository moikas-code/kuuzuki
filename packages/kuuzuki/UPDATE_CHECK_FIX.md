# Update Check Fix

## Issue
The application was checking for updates from the wrong GitHub repository:
- Was checking: `sst/kuuzuki` (doesn't exist)
- Should check: `moikas-code/kuuzuki` (your fork)

## Files Fixed

### 1. `/src/installation/index.ts`
- Changed: `https://api.github.com/repos/sst/kuuzuki/releases/latest`
- To: `https://api.github.com/repos/moikas-code/kuuzuki/releases/latest`

### 2. `/src/auth/copilot.ts`
- Changed: `sst/kuuzuki-github-copilot`
- To: `moikas-code/kuuzuki-github-copilot`

### 3. `/src/cli/cmd/github.ts`
- Changed all references from `sst/kuuzuki` to `moikas-code/kuuzuki`
- This includes GitHub Actions workflow references

## How Update Check Works
1. When TUI starts (`src/cli/cmd/tui.ts`), it checks if autoupdate is enabled
2. Calls `Installation.latest()` to fetch latest release from GitHub API
3. Compares with current version (`Installation.VERSION`)
4. If newer version available, triggers auto-upgrade
5. Publishes update event via Bus system

## Verification
- Build completed successfully ✅
- Update checks now point to correct repository ✅
- GitHub Actions will use correct repository reference ✅

---
*Fixed: 2025-08-09*