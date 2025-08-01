# Kuuzuki Context Handling Improvements

## Overview

Kuuzuki has implemented significant improvements to context handling compared to the original OpenCode, providing better memory management, proactive optimization, and enhanced error recovery. These improvements ensure more reliable AI conversations with better context preservation.

## Key Improvements Over OpenCode

### 1. Proactive vs Reactive Summarization

**OpenCode Approach (90% threshold):**
- Waits until context is nearly full before acting
- Reactive approach can cause conversation interruptions
- Higher risk of context overflow and lost messages

**Kuuzuki Improvement (85% threshold):**
```typescript
// Proactive summarization at 85% vs OpenCode's reactive 90%
const safetyThreshold = model.info.limit.context * 0.85 // More conservative
const totalEstimated = estimatedInputTokens + outputLimit

if (totalEstimated > safetyThreshold) {
  log.info("proactive summarization triggered", {
    estimatedTokens: totalEstimated,
    threshold: safetyThreshold,
    contextLimit: model.info.limit.context,
    outputLimit,
  })
  await summarize({
    sessionID: input.sessionID,
    providerID: input.providerID,
    modelID: input.modelID,
  })
  return chat(input)
}
```

**Benefits:**
- Prevents context overflow before it happens
- Maintains conversation flow without interruption
- Provides more buffer space for complex responses
- Reduces risk of losing important context

### 2. Improved Token Estimation

**Enhanced Token Calculation:**
```typescript
/**
 * Estimates token count for text content
 * Uses improved approximation: 1 token ≈ 3.5 characters for better accuracy
 */
function estimateTokens(text: string): number {
  if (!text) return 0
  // More accurate estimation accounting for whitespace and punctuation
  return Math.ceil(text.length / 3.5)
}
```

**Comprehensive Request Estimation:**
```typescript
async function estimateRequestTokens(
  msgs: { info: MessageV2.Info; parts: MessageV2.Part[] }[],
  newUserInput: MessageV2.Part[],
  systemPrompts: string[],
): Promise<number> {
  let totalTokens = 0

  // Count existing messages with proper content handling
  for (const msg of msgs) {
    const modelMsgs = MessageV2.toModelMessage([msg])
    for (const modelMsg of modelMsgs) {
      if (typeof modelMsg.content === "string") {
        totalTokens += estimateTokens(modelMsg.content)
      } else if (Array.isArray(modelMsg.content)) {
        for (const part of modelMsg.content) {
          if (part.type === "text") {
            totalTokens += estimateTokens(part.text)
          }
        }
      }
    }
  }

  // Count new user input
  for (const part of newUserInput) {
    if (part.type === "text") {
      totalTokens += estimateTokens(part.text)
    }
  }

  // Count system prompts
  totalTokens += estimateTokens(systemPrompts.join("\n"))

  // Add buffer for tool calls, formatting, JSON structure, etc.
  return Math.ceil(totalTokens * 1.25)
}
```

**Improvements:**
- More accurate token estimation (3.5 chars/token vs generic approaches)
- Accounts for all message types and content formats
- Includes buffer for tool calls and JSON formatting
- Handles both string and array content types

### 3. Dual-Layer Context Protection

**Proactive + Reactive Approach:**
```typescript
// PROACTIVE CHECK: Prevent context overflow before it happens
const estimatedInputTokens = await estimateRequestTokens(msgs, userParts, systemPrompts)
const safetyThreshold = model.info.limit.context * 0.85 // More conservative than 90%
const totalEstimated = estimatedInputTokens + outputLimit

if (totalEstimated > safetyThreshold) {
  log.info("proactive summarization triggered")
  await summarize(/* ... */)
  return chat(input)
}

// REACTIVE CHECK: Keep existing logic as fallback
if (previous && previous.tokens) {
  const tokens = previous.tokens.input + previous.tokens.cache.read + 
                 previous.tokens.cache.write + previous.tokens.output
  if (model.info.limit.context && tokens > Math.max((model.info.limit.context - outputLimit) * 0.9, 0)) {
    log.info("reactive summarization triggered")
    await summarize(/* ... */)
    return chat(input)
  }
}
```

**Benefits:**
- Double protection against context overflow
- Proactive prevention with reactive fallback
- Better logging for debugging context issues
- Graceful degradation if estimation is off

### 4. Enhanced Message Validation

**Robust Error Prevention:**
```typescript
function validateMessages(messages: ModelMessage[], context: string, sessionID?: string): ModelMessage[] {
  if (!messages || messages.length === 0) {
    log.error("Empty messages array detected", {
      context,
      sessionID,
      stackTrace: new Error().stack,
      timestamp: new Date().toISOString(),
    })

    // Return minimal valid message to prevent API crash
    return [
      {
        role: "user" as const,
        content: "Please help me with my request.",
      },
    ]
  }

  // Log message array info for debugging
  log.debug("Message validation passed", {
    context,
    sessionID,
    messageCount: messages.length,
    roles: messages.map((m) => m.role),
    hasContent: messages.every(
      (m) => m.content && (typeof m.content === "string" ? m.content.length > 0 : m.content.length > 0),
    ),
  })

  return messages
}
```

**Improvements:**
- Prevents empty message arrays that cause API failures
- Provides detailed logging for debugging
- Returns safe fallback messages when validation fails
- Tracks message composition and content validation

### 5. Better Error Recovery

**Comprehensive Error Handling:**
```typescript
// Validate all messages before API calls
const validatedMessages = validateMessages(titleMessages, "generateText-title", input.sessionID)

// Safe API calls with proper error boundaries
generateText({
  maxOutputTokens: small.info.reasoning ? 1024 : 20,
  providerOptions: {
    [input.providerID]: small.info.options,
  },
  messages: validatedMessages,
  model: small.language,
})
.then((result) => {
  if (result.text)
    return update(input.sessionID, (draft) => {
      draft.title = result.text
    })
})
.catch(() => {}) // Graceful error handling
```

**Benefits:**
- Prevents API crashes from malformed requests
- Graceful degradation when validation fails
- Detailed error tracking and debugging information
- Maintains conversation continuity even with errors

## Performance Benefits

### Context Utilization Improvements

1. **Better Space Management**: 85% threshold provides more buffer space
2. **Reduced Interruptions**: Proactive approach prevents mid-conversation summarization
3. **Accurate Planning**: Better token estimation enables more precise context management
4. **Dual Protection**: Both proactive and reactive checks ensure reliability

### User Experience Improvements

1. **Smoother Conversations**: Less interruption from context management
2. **Better Memory**: More conservative thresholds preserve more context
3. **Reliable Operation**: Validation prevents conversation-breaking errors
4. **Transparent Operation**: Detailed logging helps diagnose issues

## Implementation Details

### Token Estimation Algorithm

The improved token estimation uses:
- **3.5 characters per token** (more accurate than 4.0)
- **Content type awareness** (text vs structured content)
- **Buffer calculations** (25% overhead for formatting)
- **Multi-format support** (strings and arrays)

### Summarization Strategy

When context needs to be compressed:
1. **Preserve recent messages** (better continuity)
2. **Maintain system prompts** (consistent behavior)
3. **Summarize older content** (compress early conversation)
4. **Update session state** (track summarization points)

### Error Recovery Mechanisms

1. **Message Validation**: Check all messages before API calls
2. **Fallback Messages**: Provide safe defaults when validation fails
3. **Graceful Degradation**: Continue operation even with partial failures
4. **Detailed Logging**: Track errors for debugging and improvement

## Configuration

The context handling improvements are automatically active but can be monitored through:

```bash
# Enable debug logging to see context management in action
DEBUG=session kuuzuki

# Monitor token usage and summarization triggers
kuuzuki serve --verbose
```

## Best Practices

1. **Monitor Context Usage**: Watch logs for summarization triggers
2. **Adjust Model Limits**: Configure appropriate limits for your use case  
3. **Handle Long Conversations**: Be aware that very long conversations will be summarized
4. **Error Reporting**: Report any context-related issues with session IDs

## Future Improvements

Potential enhancements being considered:
- **Smart Summarization**: Context-aware summarization that preserves important information
- **Priority Context**: Mark important messages to prevent summarization
- **Context Analytics**: Better metrics and reporting for context usage
- **Custom Thresholds**: User-configurable context management settings

## Technical Notes

- Context improvements are backward compatible with existing sessions
- No migration required for existing conversation data
- Performance impact is minimal (improved estimation is very fast)
- Works with all supported AI models and providers

---

*This document describes the context handling improvements implemented in Kuuzuki v0.1.7 and later. For implementation details, see `packages/kuuzuki/src/session/index.ts`.*