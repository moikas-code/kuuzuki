# Enhanced Wildcard Tool Matching System

## Overview

The Enhanced Wildcard Tool Matching System implements advanced pattern matching for tool names and permissions in kuuzuki, based on OpenCode commit 1ec71e41. This system provides priority-based pattern matching, tool name filtering, and enhanced permission management with wildcard support.

## Key Features

### 1. Priority-Based Pattern Matching

The system uses a sophisticated priority algorithm that considers:

- **Exact matches**: Highest priority (1000)
- **Literal character count**: More literal characters = higher priority
- **Wildcard count**: Fewer wildcards = higher priority
- **Specificity**: More constrained patterns = higher specificity

```typescript
// Example: Matching "git push origin main"
const patterns = ["git *", "git push*", "git push origin*", "*"];
const matches = Wildcard.all(patterns, "git push origin main");

// Results ordered by priority:
// 1. "git push origin*" (most specific)
// 2. "git push*"
// 3. "git *"
// 4. "*" (least specific)
```

### 2. Tool Name Pattern Matching

Enhanced tool configuration with wildcard patterns:

```typescript
// Tool name patterns in configuration
const toolPatterns = {
  "bash*": "ask",
  "*edit*": "deny", 
  "read": "allow",
  "*": "ask"
};

// Matches with priority
Wildcard.matchToolName("bash", patterns); // Returns "bash*"
Wildcard.matchToolName("edit", patterns); // Returns "*edit*"
Wildcard.matchToolName("read", patterns); // Returns "read" (exact match)
```

### 3. Agent-Specific Tool Filtering

Enhanced agent configurations with pattern support:

```typescript
const AGENT_TOOL_CONFIG = {
  grounding: {
    patterns: {
      include: ["*fetch*", "read*", "*grep*", "bash*", "memory*"],
      exclude: ["write*", "edit*"],
      priority: "specificity"
    }
  },
  "code-reviewer": {
    patterns: {
      include: ["read*", "bash*", "*grep*", "memory*"],
      exclude: ["write*", "edit*"],
      priority: "specificity"
    }
  }
};
```

### 4. Enhanced Permission System

Advanced permission configuration with tool patterns:

```json
{
  "permission": {
    "tools": {
      "bash*": "ask",
      "*edit*": "deny",
      "read": "allow"
    },
    "patterns": {
      "priority": "specificity",
      "caseSensitive": false,
      "implicitWildcard": true
    },
    "agents": {
      "test-agent": {
        "tools": {
          "bash*": "allow",
          "*dangerous*": "deny"
        }
      }
    }
  }
}
```

## Architecture

### Core Components

#### 1. Wildcard Utility (`src/util/wildcard.ts`)

**Enhanced Functions:**
- `all(patterns, text)`: Returns all matches with priority information
- `matchToolName(toolName, patterns)`: Tool-specific pattern matching
- `matchToolNameWithResult(toolName, patterns)`: Returns detailed match info
- `filterToolNames(tools, include, exclude)`: Filter tools by patterns
- `getToolConfigPriority(toolName, config)`: Calculate configuration priority

**Priority Calculation:**
```typescript
function calculatePriority(pattern: string, text: string): number {
  if (pattern === text) return 1000; // Exact match
  
  const literalChars = pattern.replace(/[*?]/g, '').length;
  const wildcardCount = (pattern.match(/[*?]/g) || []).length;
  
  return literalChars * 10 - wildcardCount * 2;
}
```

**Specificity Calculation:**
```typescript
function calculateSpecificity(pattern: string): number {
  let specificity = 0;
  
  // Exact characters add to specificity
  specificity += pattern.replace(/[*?]/g, '').length * 4;
  
  // Single-char wildcards more specific than multi-char
  specificity += (pattern.match(/\?/g) || []).length * 2;
  specificity -= (pattern.match(/\*/g) || []).length * 1;
  
  // Word boundaries increase specificity
  if (pattern.includes(' ')) specificity += 5;
  
  // Literal start/end increases specificity
  if (pattern.length > 0 && !/[*?]/.test(pattern[0])) specificity += 3;
  if (pattern.length > 0 && !/[*?]/.test(pattern[pattern.length - 1])) specificity += 3;
  
  return specificity;
}
```

#### 2. Tool Registry (`src/tool/registry.ts`)

**Enhanced Functions:**
- `filterToolsForAgent(tools, agentName)`: Pattern-based tool filtering
- `getToolPriority(toolName, agentName)`: Calculate tool priority for agent
- `isToolAllowedForAgent(toolName, agentName)`: Check tool allowance with patterns

**Pattern-Based Filtering:**
```typescript
function filterToolsForAgent(tools: any[], agentName?: string): any[] {
  const config = AGENT_TOOL_CONFIG[agentName];
  
  if (config.patterns) {
    const includePatterns = config.patterns.include || [];
    const excludePatterns = config.patterns.exclude || [];
    
    const toolIds = tools.map(tool => tool.id);
    const filteredIds = Wildcard.filterToolNames(toolIds, includePatterns, excludePatterns);
    return tools.filter(tool => filteredIds.includes(tool.id));
  }
  
  // Fallback to legacy exact matching
  return tools.filter(tool => config.allowed?.includes(tool.id));
}
```

#### 3. Permission System (`src/permission/index.ts`)

**Enhanced Functions:**
- `checkToolNamePermission(toolName, patterns)`: Pattern-based tool permission checking
- `evaluatePermissions(permissions, type, pattern, agentName)`: Multi-level permission evaluation

**Priority System:**
1. Environment permissions (`OPENCODE_PERMISSION`)
2. Configuration file permissions
3. Default behavior (allow)

**Agent-Specific Overrides:**
```typescript
// Check agent-specific permissions first
if (agentName && permissions.agents?.[agentName]) {
  const agentPerms = permissions.agents[agentName];
  const agentResult = checkToolPermission(type, pattern, agentPerms);
  if (agentResult !== null) return agentResult;
  
  // Check agent-specific tool name patterns
  const agentToolResult = checkToolNamePermission(type, agentPerms.tools);
  if (agentToolResult !== null) return agentToolResult;
}
```

#### 4. Configuration Schema (`src/config/schema.ts`)

**Enhanced Schema:**
```typescript
tools: z
  .record(z.string(), z.enum(["ask", "allow", "deny"]))
  .optional()
  .describe("Tool name pattern-based permissions"),

patterns: z
  .object({
    priority: z.enum(["specificity", "order", "length"]).default("specificity"),
    caseSensitive: z.boolean().default(false),
    implicitWildcard: z.boolean().default(true)
  })
  .optional()
  .describe("Advanced pattern matching configuration"),

agents: z
  .record(z.string(), AgentPermissionConfig)
  .optional()
  .describe("Agent-specific permission overrides with tool pattern support")
```

## Performance Optimizations

### 1. Efficient Pattern Matching

- **Regex Compilation**: Patterns are compiled to regex once and reused
- **Early Termination**: Exact matches return immediately
- **Sorted Results**: Results are pre-sorted by priority for fast access

### 2. Caching Strategy

- **Pattern Cache**: Compiled regex patterns are cached
- **Result Cache**: Match results are cached for repeated queries
- **Priority Cache**: Priority calculations are cached per pattern

### 3. Scalability

- **Large Pattern Sets**: Efficiently handles 1000+ patterns
- **Concurrent Matching**: Thread-safe pattern matching
- **Memory Efficient**: Minimal memory overhead for pattern storage

## Usage Examples

### 1. Basic Tool Pattern Matching

```typescript
import { Wildcard } from "./util/wildcard";

// Simple pattern matching
const patterns = ["bash*", "edit*", "*read*"];
const toolName = "bash";

const match = Wildcard.matchToolName(toolName, patterns);
console.log(match); // "bash*"

// Detailed match information
const result = Wildcard.matchToolNameWithResult(toolName, patterns);
console.log(result); // { pattern: "bash*", priority: 38, specificity: 18 }
```

### 2. Agent Tool Configuration

```typescript
import { ToolRegistry } from "./tool/registry";

// Check if tool is allowed for agent
const isAllowed = ToolRegistry.isToolAllowedForAgent("bash", "grounding");
console.log(isAllowed); // true

// Get tool priority for agent
const priority = ToolRegistry.getToolPriority("bash", "grounding");
console.log(priority); // 95 (high priority)
```

### 3. Permission Configuration

```json
{
  "permission": {
    "tools": {
      "bash*": "ask",
      "*dangerous*": "deny",
      "read*": "allow"
    },
    "agents": {
      "safe-agent": {
        "tools": {
          "*": "allow"
        }
      },
      "restricted-agent": {
        "tools": {
          "read*": "allow",
          "*": "deny"
        }
      }
    }
  }
}
```

### 4. Complex Pattern Scenarios

```typescript
// Overlapping patterns with priority resolution
const patterns = [
  "git *",           // Priority: 28, Specificity: 17
  "git push*",       // Priority: 78, Specificity: 37  
  "git push origin*", // Priority: 128, Specificity: 57
  "git push origin main" // Priority: 1000, Specificity: 82 (exact)
];

const command = "git push origin main";
const matches = Wildcard.all(patterns, command);

// Results ordered by priority (highest first):
// 1. "git push origin main" (exact match)
// 2. "git push origin*" (most specific wildcard)
// 3. "git push*"
// 4. "git *"
```

## Testing

The system includes comprehensive tests covering:

- **Priority Calculation**: Exact matches, literal characters, wildcards
- **Specificity Calculation**: Word boundaries, literal start/end
- **Tool Filtering**: Include/exclude patterns, agent configurations
- **Permission Integration**: Tool patterns, agent overrides
- **Performance**: Large pattern sets, concurrent access
- **Edge Cases**: Empty patterns, special characters, invalid input

### Running Tests

```bash
bun test test/wildcard-pattern-enhancements.test.ts
```

## Migration Guide

### From Simple Arrays to Pattern Objects

**Before:**
```json
{
  "permission": ["rm *", "git push*"]
}
```

**After:**
```json
{
  "permission": {
    "bash": {
      "rm *": "ask",
      "git push*": "ask"
    },
    "tools": {
      "*dangerous*": "deny",
      "read*": "allow"
    }
  }
}
```

### Agent Configuration Migration

**Before:**
```typescript
const AGENT_TOOL_CONFIG = {
  grounding: {
    allowed: ["webfetch", "read", "grep", "bash", "memory"]
  }
};
```

**After:**
```typescript
const AGENT_TOOL_CONFIG = {
  grounding: {
    patterns: {
      include: ["*fetch*", "read*", "*grep*", "bash*", "memory*"],
      priority: "specificity"
    }
  }
};
```

## OpenCode Compatibility

The system maintains full backward compatibility with OpenCode patterns:

- **Parameter Order**: `matchOpenCode(str, pattern)` maintains OpenCode order
- **Implicit Wildcards**: Command patterns get implicit wildcards for subcommands
- **Regex Style**: `matchOpenCodeStyle()` uses OpenCode's exact regex approach
- **Environment Variables**: `OPENCODE_PERMISSION` environment variable support

## Future Enhancements

### Planned Features

1. **Regex Patterns**: Support for full regex patterns in addition to wildcards
2. **Context-Aware Matching**: Pattern matching based on current working directory
3. **Dynamic Patterns**: Runtime pattern generation based on usage patterns
4. **Machine Learning**: AI-powered pattern suggestion and optimization
5. **Performance Monitoring**: Real-time pattern matching performance metrics

### API Extensions

1. **Pattern Validation**: Enhanced pattern syntax validation
2. **Pattern Optimization**: Automatic pattern optimization for performance
3. **Pattern Analytics**: Usage statistics and effectiveness metrics
4. **Pattern Debugging**: Debug mode for pattern matching troubleshooting

## Conclusion

The Enhanced Wildcard Tool Matching System provides a robust, performant, and flexible foundation for tool configuration and permission management in kuuzuki. With its priority-based matching, agent-specific configurations, and comprehensive pattern support, it enables fine-grained control over tool access while maintaining excellent performance and OpenCode compatibility.

The system's modular architecture allows for easy extension and customization, making it suitable for a wide range of use cases from simple tool filtering to complex enterprise permission management scenarios.