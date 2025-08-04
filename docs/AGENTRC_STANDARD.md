# .agentrc Standard Specification

The `.agentrc` file is the configuration standard for kuuzuki projects, providing structured rule management and project memory capabilities.

## File Structure

```json
{
  "rules": {
    "critical": [...],
    "preferred": [...],
    "contextual": [...],
    "deprecated": [...]
  },
  "ruleMetadata": {
    "version": "2.0.0",
    "lastModified": "2025-08-03T21:57:08.566Z",
    "totalRules": 20,
    "sessionRules": [...]
  }
}
```

## Rule Categories

### Critical Rules

Must-follow rules that prevent errors or ensure quality. These have the highest priority in suggestions and conflict detection.

### Preferred Rules

Best practices and style preferences. These guide coding style and development patterns.

### Contextual Rules

Rules that reference documentation files for complex patterns. These can link to external documentation for detailed guidance.

### Deprecated Rules

Rules that are no longer relevant but kept for reference and migration purposes.

## Rule Schema

Each rule must conform to this structure:

```typescript
{
  id: string,                    // Unique identifier
  text: string,                  // Rule description
  category: "critical" | "preferred" | "contextual" | "deprecated",
  filePath?: string,             // Optional documentation file path
  reason?: string,               // Explanation for the rule
  createdAt: string,             // ISO timestamp
  lastUsed?: string,             // ISO timestamp of last usage
  usageCount: number,            // Usage tracking counter
  analytics: {                   // Usage analytics
    timesApplied: number,
    timesIgnored: number,
    effectivenessScore: number,
    userFeedback: Array<{
      rating: number,            // 1-5 star rating
      comment?: string,
      timestamp: string
    }>
  },
  documentationLinks: Array<{    // Links to documentation
    filePath: string,
    section?: string,
    lastRead?: string,
    contentHash?: string,
    autoRead: boolean
  }>,
  tags: string[]                 // Searchable tags
}
```

## Memory Tool Actions

### Basic Operations

- `memory(action="add", rule="...", category="...", reason="...")` - Add new rule
- `memory(action="update", ruleId="...", newText="...")` - Update existing rule
- `memory(action="remove", ruleId="...")` - Remove rule
- `memory(action="list", category="...")` - List rules (optionally by category)

### Advanced Features

- `memory(action="suggest", context="...")` - Get contextually relevant rules
- `memory(action="analytics", timeframe="30d")` - Show usage statistics
- `memory(action="conflicts")` - Detect rule conflicts
- `memory(action="feedback", ruleId="...", rating=5, comment="...")` - Record feedback
- `memory(action="migrate")` - Migrate legacy formats to current standard

## Automatic Initialization

When the memory tool encounters a missing `.agentrc` file, it automatically creates one with the proper structure:

```json
{
  "rules": {
    "critical": [],
    "preferred": [],
    "contextual": [],
    "deprecated": []
  },
  "ruleMetadata": {
    "version": "2.0.0",
    "lastModified": "2025-08-03T21:57:08.566Z",
    "totalRules": 0,
    "sessionRules": []
  }
}
```

## Migration Support

The memory tool handles multiple legacy formats:

1. **String Array Format**: `["rule1", "rule2"]` → Migrated to structured format
2. **Partial Structure**: Missing required fields are automatically added with defaults
3. **Mixed Formats**: Handles inconsistent rule structures gracefully

## Schema Validation

All rules are validated using Zod schemas with intelligent defaults:

- Missing `createdAt` → Current timestamp
- Missing `category` → Inferred from section
- Missing `usageCount` → Defaults to 0
- Missing `analytics` → Empty analytics object
- Missing arrays → Empty arrays

## Best Practices

### Rule Writing

- Use clear, actionable language
- Include specific reasoning in the `reason` field
- Tag rules appropriately for searchability
- Link to documentation for complex patterns

### Category Usage

- **Critical**: Security, correctness, must-follow patterns
- **Preferred**: Style guides, best practices, conventions
- **Contextual**: Complex patterns requiring documentation
- **Deprecated**: Legacy rules kept for reference

### Analytics Usage

- Regularly review unused rules with `memory(action="analytics")`
- Provide feedback on rule effectiveness
- Use conflict detection to maintain rule consistency

## Integration

The `.agentrc` standard integrates with:

- **kuuzuki CLI**: Automatic rule loading and application
- **Memory Tool**: Full CRUD operations and analytics
- **AI Context**: Rules are automatically included in AI context
- **Project Templates**: Standard rules can be included in project templates

## Version History

- **v2.0.0**: Full structured format with analytics and documentation links
- **v1.0.0**: Basic structured format with categories
- **v0.x**: Legacy string array format (deprecated)

This standard ensures consistent, maintainable rule management across all kuuzuki projects and users.
