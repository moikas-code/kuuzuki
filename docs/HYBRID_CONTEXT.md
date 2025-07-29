# Hybrid Context Management

## Overview

Kuuzuki 0.1.0 introduces an experimental Hybrid Context Management system that intelligently compresses conversations to maximize useful context within token limits. This feature addresses the common issue of losing important project context when conversations grow long.

## Features

### Intelligent Compression

- **Multi-level compression**: Light (65%), Medium (75%), Heavy (85%), Emergency (95%)
- **Semantic extraction**: Preserves architectural decisions, code patterns, and relationships
- **Smart summarization**: Compresses verbose tool outputs while keeping critical information
- **Graceful degradation**: Falls back to standard context if compression fails

### Token Efficiency

- **50-70% reduction** in token usage on average
- **3-5x more context** preserved compared to simple truncation
- **Automatic optimization** based on model limits

## Usage

### Enabling/Disabling

The hybrid context feature is **enabled by default** in v0.1.0.

#### Toggle via Command (Runtime)

```bash
# In the TUI, type:
/hybrid

# Or use the keybinding:
Ctrl+X then b
```

#### Environment Variables

```bash
# Disable for a session
KUUZUKI_HYBRID_CONTEXT_ENABLED=false kuuzuki

# Force disable (emergency override)
KUUZUKI_HYBRID_CONTEXT_FORCE_DISABLE=true kuuzuki
```

#### Persistent Toggle

The `/hybrid` command saves your preference to `~/.local/state/kuuzuki/tui`, which persists across restarts.

## How It Works

### 4-Tier Context System

1. **Recent Tier** (30k tokens)

   - Uncompressed recent messages
   - Immediate context for current work

2. **Compressed Tier** (40k tokens)

   - Lightly compressed older messages
   - Preserves decisions and outcomes

3. **Semantic Tier** (20k tokens)

   - Extracted facts and patterns
   - Architectural decisions, relationships

4. **Pinned Tier** (15k tokens)
   - User-pinned critical messages (coming in v0.2.0)
   - Never compressed

### Compression Levels

- **Light (65%)**: Removes verbose tool outputs, keeps all decisions
- **Medium (75%)**: Summarizes tool outputs, extracts key facts
- **Heavy (85%)**: Keeps only outcomes and critical decisions
- **Emergency (95%)**: Ultra-minimal, last 10 messages + critical facts

### Semantic Extraction

The system extracts and preserves:

- Architectural patterns and decisions
- Code relationships and dependencies
- Error-solution pairs
- File modifications and their purposes
- Tool usage patterns

## Performance

### Metrics

- **Compression overhead**: <100ms per operation
- **Memory usage**: Minimal increase (~10MB for large sessions)
- **Token savings**: 50-70% average, up to 80% for verbose content

### Monitoring

The system logs detailed metrics for debugging:

```
[INFO] hybrid context compression {
  sessionId: "abc123",
  level: "medium",
  before: { messages: 150, tokens: 95000 },
  after: { messages: 150, tokens: 38000 },
  savings: { percentage: 60, tokens: 57000 },
  facts: 234
}
```

## Limitations (v0.1.0)

- No cross-session persistence (coming in v0.2.0)
- No manual message pinning (coming in v0.2.0)
- Basic pattern-based extraction (ML-based coming in v0.5.0)
- No visual indicators in UI (coming in v0.4.0)

## Troubleshooting

### Context seems to be missing information

1. Check if hybrid context is enabled: Look for "hybrid context optimization" in logs
2. Try disabling to compare: `/hybrid` to toggle
3. Report specific missing context types as issues

### Performance issues

1. Check compression metrics in logs
2. Try force-disabling: `KUUZUKI_HYBRID_CONTEXT_FORCE_DISABLE=true`
3. Report performance metrics with issue

### Compression not triggering

1. Verify token usage is above 65% threshold
2. Check for errors in logs
3. Ensure hybrid context is enabled

## Configuration

Advanced configuration via environment variables:

```bash
# Compression thresholds
HYBRID_CONTEXT_LIGHT_THRESHOLD=0.65
HYBRID_CONTEXT_MEDIUM_THRESHOLD=0.75
HYBRID_CONTEXT_HEAVY_THRESHOLD=0.85
HYBRID_CONTEXT_EMERGENCY_THRESHOLD=0.95

# Token limits per tier
HYBRID_CONTEXT_RECENT_MAX_TOKENS=30000
HYBRID_CONTEXT_COMPRESSED_MAX_TOKENS=40000
HYBRID_CONTEXT_SEMANTIC_MAX_TOKENS=20000
HYBRID_CONTEXT_PINNED_MAX_TOKENS=15000
```

## Future Roadmap

See [kb/hybrid-context-roadmap.md](../kb/hybrid-context-roadmap.md) for planned features:

- v0.2.0: Cross-session persistence & pinning
- v0.3.0: Configuration UI & analytics
- v0.4.0: Visual indicators & controls
- v0.5.0: ML-based extraction
- v1.0.0: Production-ready with full features

## Feedback

This is an experimental feature. Please report issues and suggestions:

- GitHub Issues: [kuuzuki/kuuzuki](https://github.com/kuuzuki/kuuzuki/issues)
- Include "hybrid-context" in issue title
- Attach relevant log snippets

Your feedback helps shape this feature's development!
