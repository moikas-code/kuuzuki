# API Error: Tool Use/Result Mismatch

## Error Description

```
AI_APICallError: messages.455: `tool_use` ids were found without `tool_result` blocks
immediately after: toolu_014XuNewaoUKxE1SXeBNJ8k1. Each `tool_use` block must have a
corresponding `tool_result` block in the next message.
```

## Cause

This error occurs when the AI assistant's response contains tool calls (`tool_use` blocks) but the corresponding results (`tool_result` blocks) are not properly included in the message sequence. This typically happens when:

1. The response is interrupted or truncated
2. Tool execution fails but no error result is provided
3. The message formatting is incorrect

## Prevention Strategies

### 1. Ensure Complete Tool Execution

Always ensure that every tool call has a corresponding result:

```typescript
// Correct pattern
messages = [
  { role: "assistant", content: [{ type: "tool_use", id: "tool_123", ... }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "tool_123", ... }] }
]
```

### 2. Handle Tool Errors Gracefully

When a tool fails, still provide a result:

```typescript
try {
  const result = await executeTool(tool);
  return { type: "tool_result", tool_use_id: tool.id, content: result };
} catch (error) {
  return { 
    type: "tool_result", 
    tool_use_id: tool.id, 
    is_error: true,
    content: `Tool execution failed: ${error.message}` 
  };
}
```

### 3. Validate Message Sequences

Before sending to the API, validate that all tool uses have results:

```typescript
function validateMessageSequence(messages: Message[]): boolean {
  const toolUses = new Set<string>();
  const toolResults = new Set<string>();
  
  for (const message of messages) {
    if (message.content) {
      for (const block of message.content) {
        if (block.type === "tool_use") {
          toolUses.add(block.id);
        } else if (block.type === "tool_result") {
          toolResults.add(block.tool_use_id);
        }
      }
    }
  }
  
  // Check all tool uses have results
  for (const toolId of toolUses) {
    if (!toolResults.has(toolId)) {
      return false;
    }
  }
  
  return true;
}
```

## Recovery Methods

### 1. Automatic Recovery

When this error is detected, automatically add missing tool results:

```typescript
function addMissingToolResults(messages: Message[]): Message[] {
  const toolUses = extractToolUses(messages);
  const toolResults = extractToolResults(messages);
  
  const missingResults = toolUses.filter(id => !toolResults.has(id));
  
  for (const toolId of missingResults) {
    messages.push({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: toolId,
        is_error: true,
        content: "Tool execution was interrupted"
      }]
    });
  }
  
  return messages;
}
```

### 2. Session Recovery

Store tool execution state to recover from interruptions:

```typescript
class ToolExecutionTracker {
  private pendingTools = new Map<string, ToolUse>();
  
  trackToolUse(tool: ToolUse): void {
    this.pendingTools.set(tool.id, tool);
  }
  
  trackToolResult(toolId: string): void {
    this.pendingTools.delete(toolId);
  }
  
  getMissingResults(): ToolUse[] {
    return Array.from(this.pendingTools.values());
  }
}
```

## Implementation in Kuuzuki

The kuuzuki codebase should implement:

1. **Tool Result Validation**: Before sending messages to the AI provider
2. **Automatic Recovery**: Add missing tool results with error states
3. **Session Persistence**: Track tool execution across interruptions
4. **Graceful Degradation**: Continue operation even with tool failures

## Best Practices

1. **Always pair tool uses with results** - Even for errors or timeouts
2. **Validate before API calls** - Check message sequences
3. **Log tool execution** - For debugging and recovery
4. **Handle interruptions** - Save state for recovery
5. **Provide meaningful errors** - Help users understand failures

## Testing

Test scenarios should include:
- Normal tool execution flow
- Tool execution failures
- Network interruptions during tool calls
- Timeout scenarios
- Multiple concurrent tool calls

## Future Improvements

1. Implement automatic retry logic for failed tools
2. Add tool execution timeout handling
3. Create tool execution middleware for consistent handling
4. Add metrics for tool execution success rates