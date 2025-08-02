import { MessageV2 } from "../message-v2"
import { Log } from "../../util/log"
import { MessageImportance, MessageClassification, TaskState } from "./types"

export class MessageClassifier {
  private static readonly log = Log.create({ service: "message-classifier" })

  /**
   * Classify a message's importance and characteristics
   */
  static classifyMessage(
    message: { info: MessageV2.Info; parts: MessageV2.Part[] },
    activeTasks: TaskState[] = [],
  ): MessageClassification {
    const textContent = this.extractTextContent(message.parts)
    const isUserRequest = message.info.role === "user"
    const isToolOutput = this.isToolOutput(message)
    const isError = this.containsError(textContent)
    const isTaskRelated = this.isTaskRelated(textContent, activeTasks)
    const containsResults = this.containsResults(textContent)
    const taskIds = this.getRelatedTaskIds(textContent, activeTasks)

    // Calculate importance score
    let importance = MessageImportance.LOW
    let preserveReason = "general conversation"

    // Critical importance factors
    if (isError) {
      importance = MessageImportance.CRITICAL
      preserveReason = "contains error information"
    } else if (this.isTaskDefinition(textContent, isUserRequest)) {
      importance = MessageImportance.CRITICAL
      preserveReason = "defines new tasks"
    } else if (isToolOutput && containsResults) {
      importance = MessageImportance.HIGH
      preserveReason = "tool output with results"
    } else if (isTaskRelated && isUserRequest) {
      importance = MessageImportance.HIGH
      preserveReason = "user request related to active tasks"
    } else if (isTaskRelated) {
      importance = MessageImportance.MEDIUM
      preserveReason = "related to active tasks"
    } else if (containsResults) {
      importance = MessageImportance.MEDIUM
      preserveReason = "contains important results"
    } else if (this.isRecentContext(message)) {
      importance = MessageImportance.MEDIUM
      preserveReason = "recent conversation context"
    } else if (this.isNoise(textContent)) {
      importance = MessageImportance.MINIMAL
      preserveReason = "low-value content"
    }

    return {
      importance,
      isTaskRelated,
      isToolOutput,
      isError,
      isUserRequest,
      containsResults,
      taskIds,
      preserveReason,
    }
  }

  /**
   * Sort messages by importance for preservation
   */
  static sortByImportance(
    messages: Array<{
      message: { info: MessageV2.Info; parts: MessageV2.Part[] }
      classification: MessageClassification
    }>,
  ): Array<{
    message: { info: MessageV2.Info; parts: MessageV2.Part[] }
    classification: MessageClassification
  }> {
    return messages.sort((a, b) => {
      // Primary sort: importance score
      if (a.classification.importance !== b.classification.importance) {
        return b.classification.importance - a.classification.importance
      }

      // Secondary sort: task-related messages first
      if (a.classification.isTaskRelated !== b.classification.isTaskRelated) {
        return a.classification.isTaskRelated ? -1 : 1
      }

      // Tertiary sort: more recent messages first
      const aTime = a.message.info.time.created || 0
      const bTime = b.message.info.time.created || 0
      return bTime - aTime
    })
  }

  /**
   * Calculate preservation priority score
   */
  static calculatePreservationScore(
    message: { info: MessageV2.Info; parts: MessageV2.Part[] },
    classification: MessageClassification,
    activeTasks: TaskState[],
  ): number {
    let score = classification.importance

    // Boost score for task-related content
    if (classification.isTaskRelated) {
      score += 0.2
    }

    // Boost score for tool outputs
    if (classification.isToolOutput) {
      score += 0.15
    }

    // Boost score for errors
    if (classification.isError) {
      score += 0.25
    }

    // Boost score for recent messages
    const messageAge = Date.now() - (message.info.time.created || 0)
    const ageBonus = Math.max(0, 0.1 - messageAge / (1000 * 60 * 60)) // Decay over 1 hour
    score += ageBonus

    // Boost score for messages related to high-priority tasks
    const relatedHighPriorityTasks = activeTasks.filter(
      (task) => classification.taskIds.includes(task.id) && (task.priority === "critical" || task.priority === "high"),
    )
    if (relatedHighPriorityTasks.length > 0) {
      score += 0.2
    }

    return Math.min(1.0, score) // Cap at 1.0
  }

  // Private helper methods

  private static extractTextContent(parts: MessageV2.Part[]): string {
    return parts
      .filter((part) => part.type === "text")
      .map((part) => (part as any).text || "")
      .join(" ")
  }

  private static isToolOutput(message: { info: MessageV2.Info; parts: MessageV2.Part[] }): boolean {
    return message.parts.some((part) => part.type === "tool")
  }

  private static containsError(text: string): boolean {
    const errorPatterns = [
      /error:/i,
      /failed/i,
      /exception/i,
      /❌/,
      /\[error\]/i,
      /cannot/i,
      /unable to/i,
      /not found/i,
      /invalid/i,
      /syntax error/i,
      /compilation error/i,
      /runtime error/i,
    ]

    return errorPatterns.some((pattern) => pattern.test(text))
  }

  private static isTaskDefinition(text: string, isUserRequest: boolean): boolean {
    if (!isUserRequest) return false

    const taskPatterns = [
      /please\s+help\s+me/i,
      /i\s+need\s+you\s+to/i,
      /can\s+you\s+please/i,
      /\d+\.\s+/, // Numbered lists
      /[a-z]\)\s+/, // Lettered lists
      /[-*]\s+/, // Bullet lists
      /first.*then.*next/i,
      /analyze.*and.*create/i,
      /implement.*and.*test/i,
    ]

    return taskPatterns.some((pattern) => pattern.test(text)) && text.length > 50
  }

  private static isTaskRelated(text: string, activeTasks: TaskState[]): boolean {
    if (activeTasks.length === 0) return false

    return activeTasks.some((task) => {
      // Check if text relates to the original request
      const originalWords = task.originalRequest
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3)

      const textLower = text.toLowerCase()
      const matchingWords = originalWords.filter((word) => textLower.includes(word))

      // Need at least 2 matching words or 30% overlap
      return matchingWords.length >= 2 || matchingWords.length / originalWords.length >= 0.3
    })
  }

  private static containsResults(text: string): boolean {
    const resultPatterns = [
      /here\s+(?:is|are)/i,
      /result/i,
      /output/i,
      /generated/i,
      /created/i,
      /implemented/i,
      /completed/i,
      /finished/i,
      /done/i,
      /✅/,
      /analysis/i,
      /summary/i,
      /conclusion/i,
      /recommendation/i,
    ]

    return resultPatterns.some((pattern) => pattern.test(text)) && text.length > 30
  }

  private static getRelatedTaskIds(text: string, activeTasks: TaskState[]): string[] {
    return activeTasks.filter((task) => this.isTaskRelated(text, [task])).map((task) => task.id)
  }

  private static isRecentContext(message: { info: MessageV2.Info; parts: MessageV2.Part[] }): boolean {
    const messageAge = Date.now() - (message.info.time.created || 0)
    return messageAge < 1000 * 60 * 30 // Last 30 minutes
  }

  private static isNoise(text: string): boolean {
    // Very short messages
    if (text.length < 10) return true

    // Common noise patterns
    const noisePatterns = [
      /^(ok|okay|yes|no|thanks|thank you)\.?$/i,
      /^(got it|understood|sure|alright)\.?$/i,
      /^(hi|hello|hey)\.?$/i,
      /^(bye|goodbye|see you)\.?$/i,
      /^\s*[.!?]+\s*$/,
    ]

    return noisePatterns.some((pattern) => pattern.test(text.trim()))
  }
}
