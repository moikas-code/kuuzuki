import { MessageV2 } from "./message-v2"
import { HybridContext } from "./hybrid-context"
import { IncrementalTokenTracker } from "./token-tracker"

/**
 * Task-Aware Compression System
 *
 * Extends the hybrid context system with specialized handling for task management workflows.
 * Preserves todo tool outputs, task progression, and incremental work patterns.
 */
export class TaskAwareCompression {
  /**
   * Semantic patterns for identifying task-related content
   */
  private static readonly TASK_PATTERNS = {
    // Todo tool patterns
    TODO_TOOL_CALLS: /todowrite|todoread/gi,
    TODO_CONTENT: /"content":\s*"([^"]+)"/gi,
    TODO_STATUS: /"status":\s*"(pending|in_progress|completed|cancelled)"/gi,
    TODO_PRIORITY: /"priority":\s*"(high|medium|low)"/gi,

    // Task progression patterns
    TASK_COMPLETION: /\b(completed?|finished?|done|fixed|resolved|implemented)\b/gi,
    TASK_PROGRESS: /\b(working on|in progress|started|beginning|implementing)\b/gi,
    TASK_DECISIONS: /\b(decided|will|going to|plan to|next step)\b/gi,

    // Error and debugging patterns
    ERROR_PATTERNS: /\b(error|failed|exception|bug|issue|problem)\b/gi,
    SOLUTION_PATTERNS: /\b(solution|fix|resolved|workaround|corrected)\b/gi,

    // Code change patterns
    CODE_CHANGES: /\b(added|updated|modified|created|deleted|refactored)\b/gi,
    FILE_OPERATIONS: /\b(file|directory|path|src\/|packages\/)\b/gi,
  }

  /**
   * Task session indicators - higher thresholds for task-heavy sessions
   */
  private static readonly TASK_SESSION_INDICATORS = {
    TODO_TOOL_USAGE: 3, // 3+ todo tool calls indicates task session
    TASK_KEYWORDS: 5, // 5+ task-related keywords
    CODE_OPERATIONS: 4, // 4+ code operations
  }

  /**
   * Analyze if a session is task-oriented
   */
  static analyzeTaskSession(messages: MessageV2.Info[]): {
    isTaskSession: boolean
    taskScore: number
    indicators: {
      todoToolUsage: number
      taskKeywords: number
      codeOperations: number
    }
  } {
    let todoToolUsage = 0
    let taskKeywords = 0
    let codeOperations = 0

    for (const message of messages) {
      const messageText = JSON.stringify(message)

      // Count todo tool usage
      const todoMatches = messageText.match(this.TASK_PATTERNS.TODO_TOOL_CALLS)
      if (todoMatches) todoToolUsage += todoMatches.length

      // Count task-related keywords
      const taskMatches = [
        ...messageText.matchAll(this.TASK_PATTERNS.TASK_COMPLETION),
        ...messageText.matchAll(this.TASK_PATTERNS.TASK_PROGRESS),
        ...messageText.matchAll(this.TASK_PATTERNS.TASK_DECISIONS),
      ]
      taskKeywords += taskMatches.length

      // Count code operations
      const codeMatches = [
        ...messageText.matchAll(this.TASK_PATTERNS.CODE_CHANGES),
        ...messageText.matchAll(this.TASK_PATTERNS.FILE_OPERATIONS),
      ]
      codeOperations += codeMatches.length
    }

    const indicators = { todoToolUsage, taskKeywords, codeOperations }

    // Calculate task score
    const taskScore =
      (todoToolUsage >= this.TASK_SESSION_INDICATORS.TODO_TOOL_USAGE ? 3 : 0) +
      (taskKeywords >= this.TASK_SESSION_INDICATORS.TASK_KEYWORDS ? 2 : 0) +
      (codeOperations >= this.TASK_SESSION_INDICATORS.CODE_OPERATIONS ? 2 : 0)

    const isTaskSession = taskScore >= 3

    return { isTaskSession, taskScore, indicators }
  }

  /**
   * Extract task-specific semantic facts from messages
   */
  static extractTaskSemanticFacts(messages: MessageV2.Info[]): HybridContext.SemanticFact[] {
    const facts: HybridContext.SemanticFact[] = []
    const factId = () => `task_fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    for (const message of messages) {
      const messageText = JSON.stringify(message)

      // Extract todo items and their states
      const todoContentMatches = [...messageText.matchAll(this.TASK_PATTERNS.TODO_CONTENT)]
      const todoStatusMatches = [...messageText.matchAll(this.TASK_PATTERNS.TODO_STATUS)]

      if (todoContentMatches.length > 0 && todoStatusMatches.length > 0) {
        for (let i = 0; i < Math.min(todoContentMatches.length, todoStatusMatches.length); i++) {
          const content = todoContentMatches[i][1]
          const status = todoStatusMatches[i][1]

          facts.push({
            id: factId(),
            type: "tool_usage",
            content: `Task: ${content} (Status: ${status})`,
            extractedFrom: [message.id],
            confidence: 0.95,
            importance: status === "completed" ? "high" : status === "in_progress" ? "critical" : "medium",
            relatedFacts: [],
            timestamp: Date.now(),
            tags: ["todo", "task"],
          })
        }
      }

      // Extract task decisions and outcomes
      const decisionMatches = [...messageText.matchAll(this.TASK_PATTERNS.TASK_DECISIONS)]
      for (const match of decisionMatches.slice(0, 3)) {
        // Limit to 3 per message
        const context = messageText.slice(
          Math.max(0, match.index! - 100),
          Math.min(messageText.length, match.index! + match[0].length + 100),
        )

        facts.push({
          id: factId(),
          type: "decision",
          content: `Decision: ${context.trim()}`,
          extractedFrom: [message.id],
          confidence: 0.8,
          importance: "high",
          relatedFacts: [],
          timestamp: Date.now(),
          tags: ["task", "decision"],
        })
      }

      // Extract error-solution pairs
      const errorMatches = [...messageText.matchAll(this.TASK_PATTERNS.ERROR_PATTERNS)]
      const solutionMatches = [...messageText.matchAll(this.TASK_PATTERNS.SOLUTION_PATTERNS)]

      if (errorMatches.length > 0 && solutionMatches.length > 0) {
        facts.push({
          id: factId(),
          type: "error_solution",
          content: `Error resolved in message ${message.id}`,
          extractedFrom: [message.id],
          confidence: 0.9,
          importance: "critical",
          relatedFacts: [],
          timestamp: Date.now(),
          tags: ["error", "solution"],
        })
      }
    }

    return facts
  }

  /**
   * Determine if a message should be preserved during compression
   */
  static shouldPreserveMessage(
    message: MessageV2.Info,
    _parts: MessageV2.Part[],
  ): {
    preserve: boolean
    reason: string
    preservationLevel: "full" | "partial" | "summary"
  } {
    const messageText = JSON.stringify(message)

    // Always preserve todo tool outputs
    if (this.TASK_PATTERNS.TODO_TOOL_CALLS.test(messageText)) {
      return {
        preserve: true,
        reason: "Contains todo tool usage",
        preservationLevel: "full",
      }
    }

    // Check for task completion indicators
    const completionMatches = messageText.match(this.TASK_PATTERNS.TASK_COMPLETION)
    if (completionMatches && completionMatches.length >= 2) {
      return {
        preserve: true,
        reason: "Contains task completion information",
        preservationLevel: "partial",
      }
    }

    // Check for error resolution
    const hasError = this.TASK_PATTERNS.ERROR_PATTERNS.test(messageText)
    const hasSolution = this.TASK_PATTERNS.SOLUTION_PATTERNS.test(messageText)
    if (hasError && hasSolution) {
      return {
        preserve: true,
        reason: "Contains error resolution",
        preservationLevel: "partial",
      }
    }

    // Check for significant code changes
    const codeChangeMatches = messageText.match(this.TASK_PATTERNS.CODE_CHANGES)
    if (codeChangeMatches && codeChangeMatches.length >= 3) {
      return {
        preserve: true,
        reason: "Contains significant code changes",
        preservationLevel: "summary",
      }
    }

    return {
      preserve: false,
      reason: "No critical task information",
      preservationLevel: "summary",
    }
  }

  /**
   * Get task-aware compression thresholds
   */
  static getTaskCompressionThresholds(
    isTaskSession: boolean,
    taskScore: number,
  ): {
    lightThreshold: number
    mediumThreshold: number
    heavyThreshold: number
    emergencyThreshold: number
  } {
    if (isTaskSession) {
      // Higher thresholds for task sessions - compress less aggressively
      const multiplier = 1 + taskScore * 0.1 // 10% increase per task score point

      return {
        lightThreshold: 0.75 * multiplier, // Start compression later
        mediumThreshold: 0.85 * multiplier, // More conservative medium compression
        heavyThreshold: 0.92 * multiplier, // Delay heavy compression
        emergencyThreshold: 0.98 * multiplier, // Only emergency compress when nearly full
      }
    }

    // Standard thresholds for non-task sessions
    return {
      lightThreshold: 0.65,
      mediumThreshold: 0.75,
      heavyThreshold: 0.85,
      emergencyThreshold: 0.95,
    }
  }

  /**
   * Create task-aware compressed message
   */
  static async createTaskAwareCompressedMessage(
    message: MessageV2.Info,
    parts: MessageV2.Part[],
    level: HybridContext.CompressionLevel,
  ): Promise<HybridContext.CompressedMessage | null> {
    const messageText = JSON.stringify(message)
    const preservation = this.shouldPreserveMessage(message, parts)

    let semanticSummary = ""
    const preservedElements: string[] = []

    // Always preserve todo tool outputs regardless of compression level
    const todoMatches = [...messageText.matchAll(this.TASK_PATTERNS.TODO_TOOL_CALLS)]
    if (todoMatches.length > 0) {
      // Extract and preserve todo content
      const todoContent = [...messageText.matchAll(this.TASK_PATTERNS.TODO_CONTENT)]
      const todoStatus = [...messageText.matchAll(this.TASK_PATTERNS.TODO_STATUS)]

      for (let i = 0; i < todoContent.length; i++) {
        const content = todoContent[i]?.[1] || ""
        const status = todoStatus[i]?.[1] || "unknown"
        preservedElements.push(`TODO: ${content} [${status}]`)
      }
    }

    // Preserve task decisions and outcomes
    const decisionMatches = [...messageText.matchAll(this.TASK_PATTERNS.TASK_DECISIONS)]
    for (const match of decisionMatches.slice(0, level === "heavy" ? 1 : 3)) {
      const context = messageText.slice(
        Math.max(0, match.index! - 50),
        Math.min(messageText.length, match.index! + match[0].length + 50),
      )
      preservedElements.push(`DECISION: ${context.trim()}`)
    }

    // Preserve error-solution pairs
    const errorContext = this.extractErrorSolutionContext(messageText)
    if (errorContext) {
      preservedElements.push(`ERROR_RESOLUTION: ${errorContext}`)
    }

    // Build semantic summary based on preservation level
    if (preservation.preservationLevel === "full") {
      semanticSummary = preservedElements.join(" | ")
    } else if (preservation.preservationLevel === "partial") {
      semanticSummary = preservedElements.slice(0, level === "heavy" ? 2 : 5).join(" | ")
    } else {
      // Summary level - just key points
      semanticSummary = preservedElements.slice(0, level === "heavy" ? 1 : 2).join(" | ")
    }

    if (!semanticSummary.trim()) {
      return null
    }

    const originalTokens = IncrementalTokenTracker.estimateTokens(messageText)
    const compressedTokens = IncrementalTokenTracker.estimateTokens(semanticSummary)

    return {
      id: `task_compressed_${message.id}`,
      originalId: message.id,
      sessionID: message.sessionID,
      semanticSummary: semanticSummary.trim(),
      extractedFacts: [], // Will be populated by semantic extractor
      tokensSaved: originalTokens - compressedTokens,
      originalTokens,
      compressionLevel: level,
      compressedAt: Date.now(),
      preservedElements,
      // Note: Task metadata would be stored separately in the hybrid context system,
    }
  }

  /**
   * Extract error-solution context from message text
   */
  private static extractErrorSolutionContext(messageText: string): string | null {
    const errorMatches = [...messageText.matchAll(this.TASK_PATTERNS.ERROR_PATTERNS)]
    const solutionMatches = [...messageText.matchAll(this.TASK_PATTERNS.SOLUTION_PATTERNS)]

    if (errorMatches.length > 0 && solutionMatches.length > 0) {
      // Find the closest error-solution pair
      const firstError = errorMatches[0]
      const firstSolution = solutionMatches[0]

      if (firstError.index !== undefined && firstSolution.index !== undefined) {
        const start = Math.min(firstError.index, firstSolution.index)
        const end = Math.max(firstError.index + firstError[0].length, firstSolution.index + firstSolution[0].length)

        return messageText.slice(Math.max(0, start - 50), Math.min(messageText.length, end + 50)).trim()
      }
    }

    return null
  }

  /**
   * Integrate todo state with hybrid context storage
   */
  static async integrateTodoState(
    sessionID: string,
    todos: Array<{
      content: string
      status: string
      priority: string
      id: string
    }>,
  ): Promise<HybridContext.SemanticFact[]> {
    const facts: HybridContext.SemanticFact[] = []

    for (const todo of todos) {
      facts.push({
        id: `todo_state_${todo.id}`,
        type: "tool_usage",
        content: `TODO: ${todo.content} [${todo.status}] (Priority: ${todo.priority})`,
        extractedFrom: [`session_${sessionID}`],
        confidence: 1.0, // Todo state is always accurate
        importance: todo.priority === "high" ? "critical" : todo.priority === "medium" ? "high" : "medium",
        relatedFacts: [],
        timestamp: Date.now(),
        tags: ["todo", "state", todo.status],
      })
    }

    return facts
  }
}

// Task metadata is stored separately in the hybrid context system
// to avoid modifying the core CompressedMessage type
