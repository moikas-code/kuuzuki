# Hybrid Command Usage Documentation

## Overview

The `kuuzuki hybrid` command manages hybrid context settings, which control how the AI assistant processes and includes context in its responses. This feature allows for more intelligent context management by balancing between comprehensive context inclusion and performance optimization.

## Command Syntax

```bash
kuuzuki hybrid [options]
```

## Options

### --enable
Enable hybrid context mode
```bash
kuuzuki hybrid --enable
```

### --disable  
Disable hybrid context mode
```bash
kuuzuki hybrid --disable
```

### --set-threshold <value>
Set the context relevance threshold (0.0 to 1.0)
```bash
kuuzuki hybrid --set-threshold 0.7
```

### --status
Show current hybrid context settings
```bash
kuuzuki hybrid --status
```

## What is Hybrid Context?

Hybrid context mode intelligently manages which files and information are included when the AI processes requests. Instead of including everything or nothing, it uses smart heuristics to determine relevance.

### Benefits:
- **Performance**: Faster response times by including only relevant context
- **Accuracy**: Better focus on pertinent information
- **Token Efficiency**: Reduced token usage for API calls
- **Adaptive**: Learns from usage patterns

## Usage Examples

### 1. Enable Hybrid Mode
```bash
# Enable hybrid context processing
kuuzuki hybrid --enable

# Verify it's enabled
kuuzuki hybrid --status
```

### 2. Adjust Sensitivity
```bash
# Set higher threshold (more selective)
kuuzuki hybrid --set-threshold 0.8

# Set lower threshold (more inclusive)  
kuuzuki hybrid --set-threshold 0.5
```

### 3. Disable for Full Context
```bash
# Disable hybrid mode to include all context
kuuzuki hybrid --disable
```

## Configuration Details

The hybrid context settings are stored in the project configuration and affect:

1. **File Selection**: Which files are included in AI context
2. **Code Analysis**: How deeply code relationships are analyzed
3. **Memory Usage**: How much historical context is retained
4. **Search Scope**: The breadth of codebase searching

## Best Practices

### When to Enable Hybrid Mode:
- Large codebases (>1000 files)
- Limited API token budgets
- Need faster response times
- Working on focused features

### When to Disable:
- Small projects
- Complex refactoring tasks
- Need comprehensive analysis
- Debugging cross-cutting concerns

## Threshold Guidelines

- **0.9-1.0**: Very selective, only highly relevant files
- **0.7-0.8**: Balanced approach (recommended default)
- **0.5-0.6**: More inclusive, broader context
- **0.0-0.4**: Nearly everything included

## Integration with Other Commands

Hybrid mode affects these commands:
- `kuuzuki run`: Context included in AI prompts
- `kuuzuki tui`: Background context loading
- `kuuzuki serve`: API response context

## Troubleshooting

### Issue: Missing expected context
**Solution**: Lower the threshold value
```bash
kuuzuki hybrid --set-threshold 0.6
```

### Issue: Too much irrelevant context
**Solution**: Raise the threshold value
```bash
kuuzuki hybrid --set-threshold 0.85
```

### Issue: Inconsistent behavior
**Solution**: Check status and reset if needed
```bash
kuuzuki hybrid --status
kuuzuki hybrid --disable
kuuzuki hybrid --enable --set-threshold 0.7
```

## Technical Implementation

The hybrid context system uses:
- **Semantic Analysis**: Understanding code relationships
- **Usage Patterns**: Learning from interaction history
- **Dependency Graphs**: Mapping file dependencies
- **Relevance Scoring**: Calculating context importance

## Performance Impact

Typical improvements with hybrid mode:
- 30-50% reduction in token usage
- 2-3x faster initial context loading
- More focused and accurate responses
- Reduced memory footprint

## Future Enhancements

Planned improvements include:
- Auto-adjustment based on project size
- Per-file relevance overrides
- Custom inclusion/exclusion rules
- Machine learning-based optimization