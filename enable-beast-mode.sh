#!/bin/bash

# Enable Beast Mode for Upstream Sync Daemon
# This enables aggressive processing with higher thresholds and batch sizes

echo "🦁 Enabling Beast Mode for upstream sync daemon..."

# Update configuration to enable beast mode
cat > .upstream-sync-config.json << 'EOF'
{
  "upstreamRemote": "upstream",
  "upstreamBranch": "dev",
  "localBranch": "master",
  "pollInterval": 5,
  "autoMergeThreshold": 0.75,
  "dryRun": false,
  "notifyOnChanges": true,
  "maxChangesPerRun": 5,
  "beastMode": true,
  "beastModeMaxChanges": 20,
  "beastModeAutoMergeThreshold": 0.85,
  "useWorktree": true,
  "worktreePath": "../kuuzuki-daemon",
  "pathMappings": {
    "packages/opencode/": "packages/kuuzuki/",
    "packages/opencode-": "packages/kuuzuki-"
  },
  "excludePatterns": [
    "*.md",
    "docs/**",
    "*.lock",
    "package-lock.json",
    ".github/workflows/**",
    "README*",
    "CHANGELOG*",
    "LICENSE*",
    "cloud/**",
    "sdks/**",
    "packages/web/**",
    "packages/sdk/**",
    "packages/function/**",
    "packages/plugin/**",
    "**/package.json"
  ],
  "includePatterns": [
    "packages/opencode/src/**/*.ts",
    "packages/opencode/src/**/*.js",
    "packages/opencode/src/**/*.txt",
    "packages/tui/**/*.go",
    "packages/tui/**/*.ts",
    "packages/tui/**/*.js",
    "packages/opencode/bin/**/*",
    "packages/opencode/scripts/**/*"
  ]
}
EOF

echo "✅ Beast Mode enabled!"
echo "   🦁 Max changes per run: 20 (vs 5 normal)"
echo "   🎯 Auto-merge threshold: 85% (vs 75% normal)"
echo "   ⚡ Processing: Chronological (oldest → newest)"
echo ""
echo "Start the daemon with: bun run scripts/upstream-sync-daemon.ts start"
echo "Check status with: bun run scripts/upstream-sync-daemon.ts status"