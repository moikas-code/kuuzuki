# Implementation Plan: Hybrid Sliding Window + Semantic Compression

**STATUS: Core Implementation Complete ✅** (2025-01-28)
See `/kb/hybrid-context-implementation-progress.md` for current status.

## Overview

Replace the current crude token-based summarization with an intelligent hybrid context management system that preserves semantic meaning while staying within token limits. This addresses the critical issue where the 15% safety reduction (90% → 85% threshold) causes significant loss of project building context.

## Implementation Status

### Completed Phases ✅

- **Phase 1**: Foundation & Architecture ✅
- **Phase 2**: Semantic Extraction Engine ✅
- **Phase 3**: Context Compression Engine ✅
- **Phase 4**: Hybrid Context Manager ✅
- **Phase 5**: Integration with Existing System ✅ (partial - needs configuration)

### Remaining Phases 📋

- **Phase 6**: Advanced Features (cross-session persistence, pinning)
- **Phase 7**: Testing & Optimization
- **Phase 8**: Deployment & Monitoring

---

## Phase 1: Foundation & Architecture (Week 1-2) ✅ COMPLETE

### 1.1 Core Data Structures

```typescript
// New types to implement
interface SemanticFact {
  id: string
  type: "architecture" | "pattern" | "decision" | "relationship" | "error_solution"
  content: string
  importance: "critical" | "high" | "medium" | "low"
  extractedFrom: string[] // message IDs
  timestamp: number
  projectContext?: string
}

interface CompressedMessage {
  originalId: string
  semanticSummary: string
  extractedFacts: string[] // fact IDs
  tokensSaved: number
  compressionLevel: "light" | "medium" | "heavy"
}

interface ContextTier {
  name: "recent" | "compressed" | "semantic" | "pinned"
  messages: Message[] | CompressedMessage[] | SemanticFact[]
  tokenCount: number
  maxTokens: number
}
```

### 1.2 New Session Storage Schema

```typescript
// Extend existing session storage
interface SessionV3 extends SessionV2 {
  contextTiers: {
    recent: MessageV2.Info[]
    compressed: CompressedMessage[]
    semanticFacts: SemanticFact[]
    pinnedContext: MessageV2.Info[]
  }
  compressionMetrics: {
    totalOriginalTokens: number
    totalCompressedTokens: number
    compressionRatio: number
    lastCompressionTime: number
  }
}
```

### 1.3 Core Classes to Implement

- `HybridContextManager` - Main orchestrator
- `SemanticExtractor` - Extract facts from messages
- `ContextCompressor` - Handle compression logic
- `ContextReconstructor` - Rebuild context for AI requests
- `TokenTracker` - Incremental token counting

## Phase 2: Semantic Extraction Engine (Week 2-3)

### 2.1 Semantic Fact Extractors

```typescript
class SemanticExtractor {
  // Architecture extractor
  extractArchitecturalFacts(messages: MessageV2[]): SemanticFact[]

  // Code pattern extractor
  extractCodePatterns(messages: MessageV2[]): SemanticFact[]

  // Decision extractor
  extractDecisions(messages: MessageV2[]): SemanticFact[]

  // File relationship extractor
  extractFileRelationships(messages: MessageV2[]): SemanticFact[]

  // Error solution extractor
  extractErrorSolutions(messages: MessageV2[]): SemanticFact[]
}
```

### 2.2 Pattern Recognition Rules

```typescript
// Implement pattern matching for:
const EXTRACTION_PATTERNS = {
  architecture: [/uses?\s+([\w\s]+)\s+pattern/i, /built\s+with\s+([\w\s]+)/i, /architecture\s+is\s+([\w\s]+)/i],
  decisions: [/decided?\s+to\s+([\w\s]+)/i, /chose\s+([\w\s]+)\s+because/i, /going\s+with\s+([\w\s]+)/i],
  relationships: [/(\w+\.ts)\s+imports?\s+(\w+\.ts)/i, /(\w+)\s+depends\s+on\s+(\w+)/i, /(\w+)\s+extends\s+(\w+)/i],
}
```

### 2.3 Importance Scoring Algorithm

```typescript
class ImportanceScorer {
  scoreMessage(message: MessageV2, context: ProjectContext): number {
    let score = 0

    // Recency bonus (exponential decay)
    const age = Date.now() - message.time.created
    score += Math.exp(-age / (24 * 60 * 60 * 1000)) // 24h decay

    // Content type scoring
    if (message.role === "assistant" && message.parts.some((p) => p.type === "tool")) {
      score += this.scoreToolUsage(message)
    }

    // Semantic importance
    score += this.scoreSemanticContent(message.parts)

    return score
  }
}
```

## Phase 3: Context Compression Engine (Week 3-4)

### 3.1 Multi-Level Compression

```typescript
class ContextCompressor {
  // Light compression: Remove verbose tool outputs, keep decisions
  lightCompress(messages: MessageV2[]): CompressedMessage[]

  // Medium compression: Summarize tool outputs, extract key facts
  mediumCompress(messages: MessageV2[]): CompressedMessage[]

  // Heavy compression: Keep only outcomes and critical decisions
  heavyCompress(messages: MessageV2[]): CompressedMessage[]

  // Emergency compression: Ultra-minimal essential context
  emergencyCompress(messages: MessageV2[]): CompressedMessage[]
}
```

### 3.2 Compression Strategies

```typescript
// Tool output compression
compressToolOutput(toolPart: ToolPart): string {
  if (toolPart.name === 'read') {
    return `Read ${toolPart.args.filePath} (${this.estimateLines(toolPart.result)} lines)`
  }
  if (toolPart.name === 'bash') {
    return `Ran: ${toolPart.args.command} -> ${this.summarizeOutput(toolPart.result)}`
  }
  // ... other tool compressions
}

// Conversation compression
compressConversation(messages: MessageV2[]): string {
  const facts = this.extractFacts(messages)
  const decisions = this.extractDecisions(messages)
  const outcomes = this.extractOutcomes(messages)

  return `Facts: ${facts.join(', ')}. Decisions: ${decisions.join(', ')}. Outcomes: ${outcomes.join(', ')}.`
}
```

## Phase 4: Hybrid Context Manager (Week 4-5)

### 4.1 Main Context Manager

```typescript
class HybridContextManager {
  private tiers: Map<string, ContextTier>
  private tokenTracker: IncrementalTokenTracker
  private extractor: SemanticExtractor
  private compressor: ContextCompressor

  async addMessage(message: MessageV2): Promise<void> {
    // Add to recent tier
    this.tiers.get("recent").messages.push(message)
    this.tokenTracker.addMessage(message.id, this.estimateTokens(message))

    // Check if compression needed
    if (this.shouldCompress()) {
      await this.performCompression()
    }
  }

  async performCompression(): Promise<void> {
    const compressionLevel = this.determineCompressionLevel()

    switch (compressionLevel) {
      case "light":
        await this.lightCompression()
        break
      case "medium":
        await this.mediumCompression()
        break
      case "heavy":
        await this.heavyCompression()
        break
    }
  }
}
```

### 4.2 Compression Triggers

```typescript
class CompressionTriggers {
  shouldCompress(currentTokens: number, maxTokens: number): CompressionLevel | null {
    const ratio = currentTokens / maxTokens

    if (ratio > 0.95) return "emergency"
    if (ratio > 0.85) return "heavy"
    if (ratio > 0.75) return "medium"
    if (ratio > 0.65) return "light"

    return null
  }

  predictiveCompress(context: ProjectContext): boolean {
    // Predict if next interaction will exceed limits
    const predictedTokens = this.predictNextTokenUsage(context)
    return context.currentTokens + predictedTokens > context.maxTokens * 0.7
  }
}
```

## Phase 5: Integration with Existing System (Week 5-6)

### 5.1 Modify Session.chat() Function

```typescript
// Replace current token estimation with hybrid manager
export async function chat(input: ChatInput) {
  const contextManager = await HybridContextManager.forSession(input.sessionID)

  // Check if compression needed BEFORE processing
  await contextManager.checkAndCompress()

  // Get optimized context for AI request
  const optimizedContext = await contextManager.buildContextForRequest(input)

  // Continue with existing chat logic using optimizedContext
  // ...
}
```

### 5.2 Update Message Storage

```typescript
// Extend existing message storage to include semantic data
async function updateMessage(msg: MessageV2.Info) {
  // Existing storage
  await Storage.writeJSON("session/message/" + msg.sessionID + "/" + msg.id, msg)

  // New: Update hybrid context manager
  const contextManager = await HybridContextManager.forSession(msg.sessionID)
  await contextManager.addMessage(msg)

  // Existing event publishing
  Bus.publish(MessageV2.Event.Updated, { info: msg })
}
```

### 5.3 Backward Compatibility

```typescript
// Migration function for existing sessions
async function migrateSessionToV3(sessionID: string): Promise<void> {
  const messages = await messages(sessionID)
  const contextManager = new HybridContextManager(sessionID)

  // Process existing messages to extract semantic facts
  for (const msg of messages) {
    await contextManager.addMessage(msg.info, { skipCompression: true })
  }

  // Perform initial compression if needed
  await contextManager.performInitialCompression()
}
```

## Phase 6: Advanced Features (Week 6-7)

### 6.1 Cross-Session Knowledge Persistence

```typescript
class ProjectKnowledgeBase {
  // Persist semantic facts across sessions
  async saveProjectFacts(projectPath: string, facts: SemanticFact[]): Promise<void>

  // Load project context for new sessions
  async loadProjectContext(projectPath: string): Promise<SemanticFact[]>

  // Merge facts from multiple sessions
  mergeFacts(existingFacts: SemanticFact[], newFacts: SemanticFact[]): SemanticFact[]
}
```

### 6.2 Context Pinning System

```typescript
// Allow users to pin important context
interface PinnedContext {
  messageId: string
  reason: string
  pinnedAt: number
  neverCompress: boolean
}

// UI integration for pinning
class ContextPinning {
  pinMessage(messageId: string, reason: string): Promise<void>
  unpinMessage(messageId: string): Promise<void>
  listPinnedMessages(sessionId: string): Promise<PinnedContext[]>
}
```

### 6.3 Compression Analytics

```typescript
class CompressionAnalytics {
  trackCompressionEvent(event: {
    sessionId: string
    originalTokens: number
    compressedTokens: number
    compressionRatio: number
    factsExtracted: number
    compressionLevel: string
  }): void

  generateCompressionReport(sessionId: string): CompressionReport
}
```

## Phase 7: Testing & Optimization (Week 7-8)

### 7.1 Unit Tests

- Test semantic extraction accuracy
- Test compression ratios
- Test context reconstruction fidelity
- Test token counting accuracy

### 7.2 Integration Tests

- Test with real project building scenarios
- Test cross-session continuity
- Test performance under load
- Test memory usage

### 7.3 Performance Optimization

- Optimize semantic extraction algorithms
- Cache frequently accessed facts
- Implement lazy loading for large contexts
- Optimize token counting

## Phase 8: Deployment & Monitoring (Week 8)

### 8.1 Feature Flags

```typescript
// Gradual rollout with feature flags
const HYBRID_CONTEXT_ENABLED = Flag.boolean("hybrid-context-enabled", false)
const SEMANTIC_EXTRACTION_ENABLED = Flag.boolean("semantic-extraction", false)
const CROSS_SESSION_PERSISTENCE = Flag.boolean("cross-session-facts", false)
```

### 8.2 Monitoring & Metrics

- Context compression ratios
- Semantic extraction accuracy
- User satisfaction with context preservation
- Performance impact measurements
- Token usage efficiency

### 8.3 Rollback Plan

- Keep existing summarization as fallback
- Ability to disable hybrid context per session
- Migration path back to V2 if needed

## Success Metrics

### Quantitative

- **Token Efficiency**: 3-5x more effective context per token
- **Compression Ratio**: 70-80% token reduction with <10% information loss
- **Context Preservation**: 90%+ of architectural decisions preserved
- **Performance**: <100ms overhead for compression operations

### Qualitative

- Users report better continuity in long sessions
- Reduced "what were we working on?" questions
- More consistent code generation across sessions
- Better debugging context retention

## Risk Mitigation

### Technical Risks

- **Complexity**: Start with simple extraction rules, iterate
- **Performance**: Implement async processing, caching
- **Storage**: Gradual migration, backward compatibility

### User Experience Risks

- **Transparency**: Show compression status to users
- **Control**: Allow manual pinning of important context
- **Fallback**: Keep existing system as backup

## Current Problem Context

The existing system uses a crude 85% threshold that causes:

- Loss of 35k+ characters of context (architectural understanding, code patterns, file relationships)
- "Context cliffs" where important project knowledge suddenly disappears
- Multiple recursive summarization attempts that still hit token limits
- Poor project building continuity across long sessions

## Expected Outcomes

This hybrid approach will:

- Preserve 3-5x more useful context in the same token budget
- Eliminate recursive summarization loops
- Maintain architectural understanding across sessions
- Provide gradual compression instead of sudden context loss
- Enable cross-session knowledge accumulation
- Improve code generation consistency and debugging effectiveness

## Implementation Priority

**Phase 1 (Foundation)** is critical and should be started immediately to address the current context management crisis. The semantic extraction and compression engines can be developed in parallel once the foundation is solid.
