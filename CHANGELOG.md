# Changelog

All notable changes to kuuzuki will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-29

### Added

- **Hybrid Context Management (Experimental)** - Intelligent conversation compression for 50-70% more context
  - Multi-level compression (light, medium, heavy, emergency)
  - Semantic fact extraction from conversations
  - Toggle command `/hybrid` with keybinding `Ctrl+X b`
  - Environment variable controls and force-disable flag
  - Detailed metrics logging for debugging
- **NPM Package Distribution** - Install globally with `npm install -g kuuzuki`
- **Cross-Platform Support** - Works on macOS, Linux, and Windows
- **Terminal UI** - Interactive terminal interface with vim-like keybindings
- **Multiple AI Providers** - Support for Claude, OpenAI, and other providers

### Changed

- Forked from OpenCode to create community-driven development
- Simplified deployment focused on terminal/CLI usage
- Enabled hybrid context by default (can be disabled)

### Fixed

- Context loss issues in long conversations
- Token limit handling improvements

### Security

- Added force-disable flag for hybrid context (`KUUZUKI_HYBRID_CONTEXT_FORCE_DISABLE`)
- Graceful fallback when hybrid context fails

## [Unreleased]

### Planned for 0.2.0

- Cross-session knowledge persistence
- Message pinning system
- Project-level fact storage

### Planned for 0.3.0

- Configuration UI for hybrid context
- Compression analytics dashboard
- Performance monitoring

See [kb/hybrid-context-roadmap.md](kb/hybrid-context-roadmap.md) for full roadmap.

---

## Fork History

Kuuzuki is a community fork of [OpenCode](https://github.com/sst/opencode) by SST.

### Why Fork?

- Focus on terminal/CLI as primary interface
- Community-driven development model
- NPM distribution for easier installation
- Extended functionality through plugins (coming soon)
