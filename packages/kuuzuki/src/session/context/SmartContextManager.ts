import { MessageV2 } from "../message-v2"
import { Log } from "../../util/log"
import { TaskTracker } from "./TaskTracker"
import { MessageClassifier } from "./MessageClassifier"
import {
  ContextCompactionResult,
  ContextCompactionOptions,
  TaskState,
  MessageClassification,
  ContextMetrics,
} from "./types"

export class SmartContextManager {
  private static readonly log = Log.create({ service: "smart-context-manager" })
  private taskTracker = new TaskTracker()

  /**
   * Intelligently compact context while preserving task continuity
   */
  async compactContext(
    messages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }>,
    options: ContextCompactionOptions,
  ): Promise<ContextCompactionResult> {
    const startTime = Date.now()

    SmartContextManager.log.info("starting smart context compaction", {
      totalMessages: messages.length,
      maxTokens: options.maxTokens,
      preserveTaskContext: options.preserveTaskContext,
    })

    // Step 1: Analyze all messages for tasks
    const activeTasks = this.analyzeMessagesForTasks(messages)

    // Step 2: Classify all messages
    const classifiedMessages = this.classifyAllMessages(messages, activeTasks)

    // Step 3: Calculate current token usage
    const currentTokens = this.calculateTotalTokens(messages)

    // Step 4: Determine if compaction is needed
    if (currentTokens <= options.maxTokens) {
      SmartContextManager.log.info("no compaction needed", {
        currentTokens,
        maxTokens: options.maxTokens,
      })

      return {
        trimmedMessages: messages,
        preservedTasks: activeTasks,
        continuationPrompt: null,
        tokensRemoved: 0,
        tokensPreserved: currentTokens,
        preservationRatio: 1.0,
        compactionStrategy: "no-compaction-needed",
      }
    }

    // Step 5: Smart compaction
    const compactionResult = this.performSmartCompaction(classifiedMessages, activeTasks, options)

    // Step 6: Generate continuation prompt if needed
    const continuationPrompt = options.taskContinuationPrompts
      ? this.taskTracker.generateContinuationPrompt(activeTasks)
      : null

    const endTime = Date.now()
    SmartContextManager.log.info("smart context compaction completed", {
      duration: endTime - startTime,
      originalMessages: messages.length,
      preservedMessages: compactionResult.trimmedMessages.length,
      tokensRemoved: compactionResult.tokensRemoved,
      preservationRatio: compactionResult.preservationRatio,
      strategy: compactionResult.compactionStrategy,
    })

    return {
      ...compactionResult,
      preservedTasks: activeTasks,
      continuationPrompt,
    }
  }

  /**
   * Get context metrics for analysis
   */
  getContextMetrics(messages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }>): ContextMetrics {
    const activeTasks = this.analyzeMessagesForTasks(messages)
    const classifiedMessages = this.classifyAllMessages(messages, activeTasks)

    const totalTokens = this.calculateTotalTokens(messages)
    const taskMessages = classifiedMessages.filter((cm) => cm.classification.isTaskRelated).length
    const toolOutputMessages = classifiedMessages.filter((cm) => cm.classification.isToolOutput).length
    const errorMessages = classifiedMessages.filter((cm) => cm.classification.isError).length

    const averageImportance =
      classifiedMessages.reduce((sum, cm) => sum + cm.classification.importance, 0) / classifiedMessages.length

    return {
      totalMessages: messages.length,
      totalTokens,
      taskMessages,
      toolOutputMessages,
      errorMessages,
      averageImportance,
      preservationEfficiency: this.calculatePreservationEfficiency(classifiedMessages),
    }
  }

  // Private methods

  private analyzeMessagesForTasks(messages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }>): TaskState[] {
    const tasks: TaskState[] = []

    for (const message of messages) {
      const task = this.taskTracker.analyzeMessage(message)
      if (task) {
        tasks.push(task)
      }
    }

    // Update task progress based on assistant responses
    for (const message of messages) {
      if (message.info.role === "assistant") {
        for (const task of tasks) {
          this.taskTracker.updateTaskProgress(task.id, message)
        }
      }
    }

    return this.taskTracker.getActiveTasks()
  }

  private classifyAllMessages(
    messages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }>,
    activeTasks: TaskState[],
  ): Array<{
    message: { info: MessageV2.Info; parts: MessageV2.Part[] }
    classification: MessageClassification
    tokens: number
    preservationScore: number
  }> {
    return messages.map((message) => {
      const classification = MessageClassifier.classifyMessage(message, activeTasks)
      const tokens = this.estimateMessageTokens(message)
      const preservationScore = MessageClassifier.calculatePreservationScore(message, classification, activeTasks)

      return {
        message,
        classification,
        tokens,
        preservationScore,
      }
    })
  }

  private performSmartCompaction(
    classifiedMessages: Array<{
      message: { info: MessageV2.Info; parts: MessageV2.Part[] }
      classification: MessageClassification
      tokens: number
      preservationScore: number
    }>,
    activeTasks: TaskState[],
    options: ContextCompactionOptions,
  ): Omit<ContextCompactionResult, "preservedTasks" | "continuationPrompt"> {
    const totalTokens = classifiedMessages.reduce((sum, cm) => sum + cm.tokens, 0)
    const targetTokens = options.maxTokens

    // Strategy 1: Preserve critical messages first
    if (options.preserveTaskContext || options.preserveErrors || options.preserveToolOutputs) {
      return this.preserveCriticalFirst(classifiedMessages, targetTokens, options)
    }

    // Strategy 2: Recent messages with importance weighting
    return this.preserveRecentWithImportance(classifiedMessages, targetTokens, options)
  }

  private preserveCriticalFirst(
    classifiedMessages: Array<{
      message: { info: MessageV2.Info; parts: MessageV2.Part[] }
      classification: MessageClassification
      tokens: number
      preservationScore: number
    }>,
    targetTokens: number,
    options: ContextCompactionOptions,
  ): Omit<ContextCompactionResult, "preservedTasks" | "continuationPrompt"> {
    const preserved: typeof classifiedMessages = []
    let currentTokens = 0

    // Sort by preservation score (highest first)
    const sortedMessages = [...classifiedMessages].sort((a, b) => b.preservationScore - a.preservationScore)

    // Phase 1: Always preserve critical messages
    for (const cm of sortedMessages) {
      const shouldPreserve =
        (options.preserveTaskContext && cm.classification.isTaskRelated) ||
        (options.preserveErrors && cm.classification.isError) ||
        (options.preserveToolOutputs && cm.classification.isToolOutput) ||
        cm.classification.importance >= 0.9

      if (shouldPreserve && currentTokens + cm.tokens <= targetTokens) {
        preserved.push(cm)
        currentTokens += cm.tokens
      }
    }

    // Phase 2: Fill remaining space with highest-scoring messages
    for (const cm of sortedMessages) {
      if (!preserved.includes(cm) && currentTokens + cm.tokens <= targetTokens) {
        preserved.push(cm)
        currentTokens += cm.tokens
      }
    }

    // Phase 3: Ensure minimum recent messages
    const recentMessages = classifiedMessages.slice(-options.minRecentMessages)
    for (const cm of recentMessages) {
      if (!preserved.includes(cm) && currentTokens + cm.tokens <= targetTokens * 1.1) {
        // Allow 10% overflow for recent messages
        preserved.push(cm)
        currentTokens += cm.tokens
      }
    }

    // Sort preserved messages back to chronological order
    const trimmedMessages = preserved
      .sort((a, b) => (a.message.info.time.created || 0) - (b.message.info.time.created || 0))
      .map((cm) => cm.message)

    const originalTokens = classifiedMessages.reduce((sum, cm) => sum + cm.tokens, 0)
    const tokensRemoved = originalTokens - currentTokens

    return {
      trimmedMessages,
      tokensRemoved,
      tokensPreserved: currentTokens,
      preservationRatio: currentTokens / originalTokens,
      compactionStrategy: "critical-first-preservation",
    }
  }

  private preserveRecentWithImportance(
    classifiedMessages: Array<{
      message: { info: MessageV2.Info; parts: MessageV2.Part[] }
      classification: MessageClassification
      tokens: number
      preservationScore: number
    }>,
    targetTokens: number,
    options: ContextCompactionOptions,
  ): Omit<ContextCompactionResult, "preservedTasks" | "continuationPrompt"> {
    const preserved: typeof classifiedMessages = []
    let currentTokens = 0

    // Start from most recent and work backwards
    for (let i = classifiedMessages.length - 1; i >= 0; i--) {
      const cm = classifiedMessages[i]

      // Always try to preserve recent messages
      const isRecent = i >= classifiedMessages.length - options.minRecentMessages
      const hasHighImportance = cm.preservationScore >= 0.7

      if ((isRecent || hasHighImportance) && currentTokens + cm.tokens <= targetTokens) {
        preserved.unshift(cm) // Add to beginning to maintain order
        currentTokens += cm.tokens
      }
    }

    const trimmedMessages = preserved.map((cm) => cm.message)
    const originalTokens = classifiedMessages.reduce((sum, cm) => sum + cm.tokens, 0)
    const tokensRemoved = originalTokens - currentTokens

    return {
      trimmedMessages,
      tokensRemoved,
      tokensPreserved: currentTokens,
      preservationRatio: currentTokens / originalTokens,
      compactionStrategy: "recent-with-importance",
    }
  }

  private calculateTotalTokens(messages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }>): number {
    return messages.reduce((total, message) => {
      return total + this.estimateMessageTokens(message)
    }, 0)
  }

  private estimateMessageTokens(message: { info: MessageV2.Info; parts: MessageV2.Part[] }): number {
    let tokens = 0

    for (const part of message.parts) {
      if (part.type === "text") {
        const text = (part as any).text || ""
        tokens += Math.ceil(text.length / 3.5)
      } else if (part.type === "tool") {
        // Tool calls have overhead
        tokens += 50
      }
    }

    return tokens
  }

  private calculatePreservationEfficiency(
    classifiedMessages: Array<{
      message: { info: MessageV2.Info; parts: MessageV2.Part[] }
      classification: MessageClassification
      tokens: number
      preservationScore: number
    }>,
  ): number {
    const totalImportance = classifiedMessages.reduce((sum, cm) => sum + cm.classification.importance, 0)
    const totalTokens = classifiedMessages.reduce((sum, cm) => sum + cm.tokens, 0)

    return totalTokens > 0 ? totalImportance / totalTokens : 0
  }
}
