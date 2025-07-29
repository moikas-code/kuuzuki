# Task-Aware Compression System

## Overview

The Task-Aware Compression System extends Kuuzuki's hybrid context management with specialized handling for task management workflows. It preserves todo tool outputs, task progression information, and incremental work patterns that are critical for maintaining context in development sessions.

## Problem Statement

The original hybrid context system was designed for general conversation compression but doesn't account for the structured, incremental nature of task management workflows. This led to:

- **Lost Todo Context**: Todo tool outputs being compressed away, losing track of task states
- **Missing Task Progression**: Important task completion and decision information being lost
- **Inefficient Compression**: Task-heavy sessions being compressed too aggressively
- **Broken Workflows**: Users losing context of what they were working on

## Solution Architecture

### Core Components

#### 1. TaskAwareCompression Class

- **Semantic Pattern Recognition**: Identifies task-related content using regex patterns
- **Session Analysis**: Determines if a session is task-oriented based on usage patterns
- **Preservation Logic**: Decides what content should be preserved during compression
- **Adaptive Thresholds**: Provides higher compression thresholds for task sessions

#### 2. Integration with HybridContextManager

- **Task Session Detection**: Automatically analyzes recent messages to detect task sessions
- **Todo State Integration**: Pulls current todo state and converts to semantic facts
- **Enhanced Compression**: Uses task-aware compression alongside standard compression
- **Threshold Adaptation**: Applies task-aware thresholds to delay compression

### Key Features

#### Semantic Pattern Recognition

The system recognizes several types of task-related content:

```typescript
// Todo tool patterns
TODO_TOOL_CALLS: /todowrite|todoread/gi
TODO_CONTENT: /"content":\s*"([^"]+)"/gi
TODO_STATUS: /"status":\s*"(pending|in_progress|completed|cancelled)"/gi

// Task progression patterns
TASK_COMPLETION: /\b(completed?|finished?|done|fixed|resolved|implemented)\b/gi
TASK_PROGRESS: /\b(working on|in progress|started|beginning|implementing)\b/gi
TASK_DECISIONS: /\b(decided|will|going to|plan to|next step)\b/gi

// Error and solution patterns
ERROR_PATTERNS: /\b(error|failed|exception|bug|issue|problem)\b/gi
SOLUTION_PATTERNS: /\b(solution|fix|resolved|workaround|corrected)\b/gi
```

#### Task Session Detection

Sessions are classified as task-oriented based on:

- **Todo Tool Usage**: 3+ todo tool calls indicates task session
- **Task Keywords**: 5+ task-related keywords in recent messages
- **Code Operations**: 4+ code change operations

#### Adaptive Compression Thresholds

Task sessions get higher compression thresholds:

```typescript
// Standard thresholds
lightThreshold: 0.65 // Start compression at 65% capacity
mediumThreshold: 0.75 // Medium compression at 75%
heavyThreshold: 0.85 // Heavy compression at 85%
emergencyThreshold: 0.95 // Emergency at 95%

// Task session thresholds (with multiplier based on task score)
lightThreshold: 0.75 * (1 + taskScore * 0.1) // Start later
mediumThreshold: 0.85 * (1 + taskScore * 0.1) // More conservative
heavyThreshold: 0.92 * (1 + taskScore * 0.1) // Delay heavy compression
emergencyThreshold: 0.98 * (1 + taskScore * 0.1) // Only when nearly full
```

#### Content Preservation Levels

1. **Full Preservation**: Todo tool outputs are always preserved completely
2. **Partial Preservation**: Task completion and error resolution information
3. **Summary Preservation**: Key decisions and significant code changes

#### Semantic Fact Extraction

The system extracts task-specific semantic facts:

- **Tool Usage Facts**: Todo items with their current status and priority
- **Decision Facts**: Important decisions made during task execution
- **Error Solution Facts**: Error-resolution pairs for future reference

## Implementation Details

### Integration Points

#### 1. HybridContextManager Enhancement

```typescript
// Added task session tracking
private isTaskSession: boolean = false
private taskScore: number = 0

// Enhanced message addition with task analysis
async addMessage(message: MessageV2.Info, options?: { skipCompression?: boolean }) {
  // Update task session analysis
  await this.updateTaskSessionAnalysis()

  // Use task-aware compression thresholds
  if (!options?.skipCompression && this.shouldCompress()) {
    await this.performCompression()
  }
}
```

#### 2. Todo State Integration

```typescript
// Integrate current todo state with hybrid context
private async integrateTodoState(): Promise<void> {
  const todoState = App.state("todo-tool", () => ({}))()
  const sessionTodos = todoState[this.sessionID] || []

  if (sessionTodos.length > 0) {
    const todoFacts = await TaskAwareCompression.integrateTodoState(this.sessionID, sessionTodos)

    // Add todo facts to semantic facts
    for (const fact of todoFacts) {
      this.semanticFacts.set(fact.id, fact)
    }
  }
}
```

#### 3. Enhanced Compression Logic

```typescript
// Use task-aware compression if available
const taskAwareCompressed = await TaskAwareCompression.createTaskAwareCompressedMessage(message, parts, level)

if (taskAwareCompressed) {
  return taskAwareCompressed
}

// Fallback to original compression logic
```

### Message Preservation Strategy

#### Always Preserve

- Todo tool outputs (todowrite/todoread calls)
- Task completion notifications
- Error-solution pairs
- Critical decisions

#### Conditionally Preserve

- Task progress updates (based on compression level)
- Code change summaries
- Non-critical decisions

#### Compress Normally

- General conversation
- Verbose tool outputs (non-todo)
- Repeated information

## Usage Examples

### Task Session Detection

```typescript
const messages = await getRecentMessages(10)
const analysis = TaskAwareCompression.analyzeTaskSession(messages)

if (analysis.isTaskSession) {
  console.log(`Task session detected with score: ${analysis.taskScore}`)
  console.log(`Todo tool usage: ${analysis.indicators.todoToolUsage}`)
  console.log(`Task keywords: ${analysis.indicators.taskKeywords}`)
}
```

### Semantic Fact Extraction

```typescript
const taskFacts = TaskAwareCompression.extractTaskSemanticFacts(messages)

// Example extracted facts:
// - "Task: Fix authentication bug (Status: completed)"
// - "Decision: Use JWT tokens for session management"
// - "Error resolved in message msg_123"
```

### Compression Threshold Adaptation

```typescript
const thresholds = TaskAwareCompression.getTaskCompressionThresholds(isTaskSession, taskScore)

// Task sessions get higher thresholds:
// lightThreshold: 0.825 (vs 0.65 for regular sessions)
// mediumThreshold: 0.935 (vs 0.75 for regular sessions)
```

## Benefits

### For Users

- **Preserved Context**: Never lose track of todo items and task progress
- **Better Continuity**: Task decisions and outcomes are maintained across sessions
- **Reduced Repetition**: Don't need to re-explain completed work

### For System Performance

- **Intelligent Compression**: Only compress when necessary for task sessions
- **Semantic Preservation**: Keep meaningful information while reducing token usage
- **Adaptive Behavior**: System learns from usage patterns

### For Development Workflows

- **Task Tracking**: Automatic preservation of task management information
- **Error Learning**: Error-solution pairs are preserved for future reference
- **Decision History**: Important decisions are maintained in context

## Configuration

The system uses several configurable thresholds:

```typescript
// Task session detection thresholds
TASK_SESSION_INDICATORS = {
  TODO_TOOL_USAGE: 3, // 3+ todo tool calls
  TASK_KEYWORDS: 5, // 5+ task-related keywords
  CODE_OPERATIONS: 4, // 4+ code operations
}

// Compression threshold multipliers
// Higher task scores = higher thresholds = less compression
const multiplier = 1 + taskScore * 0.1 // 10% increase per task score point
```

## Testing

The system includes comprehensive tests covering:

- Task session detection accuracy
- Semantic fact extraction
- Message preservation logic
- Compression threshold adaptation
- Todo state integration

Run tests with:

```bash
bun test packages/kuuzuki/test/task-aware-compression.test.ts
```

## Future Enhancements

### Planned Features

1. **Machine Learning Integration**: Learn from user behavior to improve task detection
2. **Cross-Session Task Tracking**: Maintain task context across multiple sessions
3. **Priority-Based Compression**: Use todo priority to influence preservation decisions
4. **Task Template Recognition**: Identify common task patterns and optimize for them

### Potential Improvements

1. **Natural Language Processing**: Better understanding of task-related content
2. **Integration with External Tools**: Connect with project management systems
3. **Visual Task Tracking**: UI components to show preserved task information
4. **Performance Optimization**: Reduce computational overhead of pattern matching

## Conclusion

The Task-Aware Compression System represents a significant improvement in context management for development workflows. By understanding the structured nature of task management and preserving critical information, it ensures that users maintain context and productivity across long development sessions.

The system is designed to be:

- **Transparent**: Works automatically without user intervention
- **Adaptive**: Learns from usage patterns and adjusts behavior
- **Efficient**: Balances context preservation with performance
- **Extensible**: Can be enhanced with additional task-aware features

This implementation provides a solid foundation for intelligent context management in AI-assisted development environments.
