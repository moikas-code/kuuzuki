import { MessageV2 } from "../message-v2"
import { Identifier } from "../../id/id"
import { Log } from "../../util/log"
import { TaskState, SubTask, TaskStatus, TaskPriority, TaskPattern } from "./types"

export class TaskTracker {
  private static readonly log = Log.create({ service: "task-tracker" })
  private tasks = new Map<string, TaskState>()

  // Advanced task patterns for different request types
  private static readonly TASK_PATTERNS: TaskPattern[] = [
    {
      pattern: /please\s+help\s+me\s+(.*?)(?:\n\d+\.|\n[a-z]\)|\n-|\n\*|$)/gis,
      priority: TaskPriority.HIGH,
      description: "Help request with implicit subtasks",
      extractSubtasks: (match, fullText) => TaskTracker.extractNumberedList(fullText),
    },
    {
      pattern: /i\s+need\s+you\s+to:?\s*(.*?)(?:\n\d+\.|\n[a-z]\)|\n-|\n\*|$)/gis,
      priority: TaskPriority.HIGH,
      description: "Direct task assignment",
      extractSubtasks: (match, fullText) => TaskTracker.extractNumberedList(fullText),
    },
    {
      pattern: /(?:^|\n)\s*\d+\.\s+(.+?)(?=\n\s*\d+\.|\n\s*[a-z]\)|\n\s*[-*]|$)/gis,
      priority: TaskPriority.MEDIUM,
      description: "Numbered list of tasks",
      extractSubtasks: (match, fullText) => TaskTracker.extractNumberedList(fullText),
    },
    {
      pattern: /(?:^|\n)\s*[a-z]\)\s+(.+?)(?=\n\s*[a-z]\)|\n\s*\d+\.|\n\s*[-*]|$)/gis,
      priority: TaskPriority.MEDIUM,
      description: "Lettered list of tasks",
      extractSubtasks: (match, fullText) => TaskTracker.extractLetteredList(fullText),
    },
    {
      pattern: /(?:^|\n)\s*[-*]\s+(.+?)(?=\n\s*[-*]|\n\s*\d+\.|\n\s*[a-z]\)|$)/gis,
      priority: TaskPriority.MEDIUM,
      description: "Bulleted list of tasks",
      extractSubtasks: (match, fullText) => TaskTracker.extractBulletList(fullText),
    },
    {
      pattern: /(?:first|then|next|after\s+that|finally|also|additionally)[\s,]+(.*?)(?=\n|$)/gis,
      priority: TaskPriority.MEDIUM,
      description: "Sequential task indicators",
      extractSubtasks: (match, fullText) => TaskTracker.extractSequentialTasks(fullText),
    },
  ]

  /**
   * Analyze a message for task content and track it
   */
  analyzeMessage(message: { info: MessageV2.Info; parts: MessageV2.Part[] }): TaskState | null {
    if (message.info.role !== "user") return null

    const textContent = this.extractTextContent(message.parts)
    if (!textContent || textContent.length < 20) return null

    const detectedTasks = this.detectTasks(textContent)
    if (detectedTasks.length === 0) return null

    const taskState: TaskState = {
      id: Identifier.ascending("session"),
      originalRequest: textContent,
      subtasks: detectedTasks,
      completed: [],
      inProgress: [],
      pending: detectedTasks.map((t) => t.id),
      estimatedTokens: this.estimateTokens(textContent),
      priority: this.determinePriority(textContent, detectedTasks),
      createdAt: message.info.time.created || Date.now(),
      lastUpdated: Date.now(),
    }

    this.tasks.set(taskState.id, taskState)

    TaskTracker.log.info("detected new task", {
      taskId: taskState.id,
      subtaskCount: detectedTasks.length,
      priority: taskState.priority,
      estimatedTokens: taskState.estimatedTokens,
    })

    return taskState
  }

  /**
   * Update task progress based on assistant responses
   */
  updateTaskProgress(taskId: string, assistantMessage: { info: MessageV2.Info; parts: MessageV2.Part[] }): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    const textContent = this.extractTextContent(assistantMessage.parts)
    const completionIndicators = this.detectCompletionIndicators(textContent)

    // Move tasks from pending to in_progress or completed
    for (const indicator of completionIndicators) {
      const matchingSubtask = task.subtasks.find((st) => this.isSubtaskMatch(st.description, indicator))

      if (matchingSubtask) {
        this.updateSubtaskStatus(task, matchingSubtask.id, TaskStatus.COMPLETED)
      }
    }

    // Detect if assistant is working on something
    const workingIndicators = this.detectWorkingIndicators(textContent)
    for (const indicator of workingIndicators) {
      const matchingSubtask = task.subtasks.find((st) => this.isSubtaskMatch(st.description, indicator))

      if (matchingSubtask && matchingSubtask.status === TaskStatus.PENDING) {
        this.updateSubtaskStatus(task, matchingSubtask.id, TaskStatus.IN_PROGRESS)
      }
    }

    task.lastUpdated = Date.now()
  }

  /**
   * Get active tasks that need continuation
   */
  getActiveTasks(): TaskState[] {
    return Array.from(this.tasks.values()).filter((task) => task.pending.length > 0 || task.inProgress.length > 0)
  }

  /**
   * Generate continuation prompt for incomplete tasks
   */
  generateContinuationPrompt(activeTasks: TaskState[]): string | null {
    if (activeTasks.length === 0) return null

    const prompts: string[] = []

    for (const task of activeTasks) {
      const pendingSubtasks = task.subtasks.filter(
        (st) => task.pending.includes(st.id) || task.inProgress.includes(st.id),
      )

      if (pendingSubtasks.length > 0) {
        const taskSummary = this.summarizeTask(task)
        const remainingItems = pendingSubtasks.map((st, idx) => `${idx + 1}. ${st.description}`).join("\n")

        prompts.push(`Continuing with the remaining tasks from your request "${taskSummary}":\n${remainingItems}`)
      }
    }

    return prompts.length > 0 ? prompts.join("\n\n") : null
  }

  /**
   * Check if a message is related to any active tasks
   */
  isTaskRelated(message: { info: MessageV2.Info; parts: MessageV2.Part[] }): boolean {
    const textContent = this.extractTextContent(message.parts)
    if (!textContent) return false

    const activeTasks = this.getActiveTasks()

    return activeTasks.some((task) =>
      task.subtasks.some((subtask) => this.isSubtaskMatch(subtask.description, textContent)),
    )
  }

  /**
   * Get task IDs related to a message
   */
  getRelatedTaskIds(message: { info: MessageV2.Info; parts: MessageV2.Part[] }): string[] {
    const textContent = this.extractTextContent(message.parts)
    if (!textContent) return []

    const relatedTasks: string[] = []

    for (const [taskId, task] of this.tasks) {
      if (task.subtasks.some((subtask) => this.isSubtaskMatch(subtask.description, textContent))) {
        relatedTasks.push(taskId)
      }
    }

    return relatedTasks
  }

  // Private helper methods

  private extractTextContent(parts: MessageV2.Part[]): string {
    return parts
      .filter((part) => part.type === "text")
      .map((part) => (part as any).text)
      .join(" ")
  }

  private detectTasks(text: string): SubTask[] {
    const allSubtasks: SubTask[] = []

    for (const pattern of TaskTracker.TASK_PATTERNS) {
      const matches = Array.from(text.matchAll(pattern.pattern))
      if (matches.length > 0) {
        const subtasks = pattern.extractSubtasks(matches[0], text)
        allSubtasks.push(...subtasks)
      }
    }

    // Deduplicate and clean up
    return this.deduplicateSubtasks(allSubtasks)
  }

  private static extractNumberedList(text: string): SubTask[] {
    const pattern = /(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|\n\s*[a-z]\)|\n\s*[-*]|$)/gis
    const matches = Array.from(text.matchAll(pattern))

    return matches.map((match) => ({
      id: Identifier.ascending("part"),
      description: match[2].trim(),
      status: TaskStatus.PENDING,
      estimatedTokens: Math.ceil(match[2].length / 3.5) * 10, // Rough estimate
      dependencies: [],
      messageIds: [],
    }))
  }

  private static extractLetteredList(text: string): SubTask[] {
    const pattern = /(?:^|\n)\s*([a-z])\)\s+(.+?)(?=\n\s*[a-z]\)|\n\s*\d+\.|\n\s*[-*]|$)/gis
    const matches = Array.from(text.matchAll(pattern))

    return matches.map((match) => ({
      id: Identifier.ascending("part"),
      description: match[2].trim(),
      status: TaskStatus.PENDING,
      estimatedTokens: Math.ceil(match[2].length / 3.5) * 10,
      dependencies: [],
      messageIds: [],
    }))
  }

  private static extractBulletList(text: string): SubTask[] {
    const pattern = /(?:^|\n)\s*[-*]\s+(.+?)(?=\n\s*[-*]|\n\s*\d+\.|\n\s*[a-z]\)|$)/gis
    const matches = Array.from(text.matchAll(pattern))

    return matches.map((match) => ({
      id: Identifier.ascending("part"),
      description: match[1].trim(),
      status: TaskStatus.PENDING,
      estimatedTokens: Math.ceil(match[1].length / 3.5) * 10,
      dependencies: [],
      messageIds: [],
    }))
  }

  private static extractSequentialTasks(text: string): SubTask[] {
    const pattern = /(?:first|then|next|after\s+that|finally|also|additionally)[\s,]+(.*?)(?=\n|$)/gis
    const matches = Array.from(text.matchAll(pattern))

    return matches.map((match) => ({
      id: Identifier.ascending("part"),
      description: match[1].trim(),
      status: TaskStatus.PENDING,
      estimatedTokens: Math.ceil(match[1].length / 3.5) * 10,
      dependencies: [],
      messageIds: [],
    }))
  }

  private deduplicateSubtasks(subtasks: SubTask[]): SubTask[] {
    const seen = new Set<string>()
    return subtasks.filter((subtask) => {
      const normalized = subtask.description.toLowerCase().trim()
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
  }

  private determinePriority(text: string, subtasks: SubTask[]): TaskPriority {
    const urgentWords = /urgent|asap|immediately|critical|emergency/i
    const importantWords = /important|priority|need|must|should/i

    if (urgentWords.test(text)) return TaskPriority.CRITICAL
    if (importantWords.test(text)) return TaskPriority.HIGH
    if (subtasks.length > 5) return TaskPriority.HIGH
    if (subtasks.length > 2) return TaskPriority.MEDIUM
    return TaskPriority.LOW
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5)
  }

  private detectCompletionIndicators(text: string): string[] {
    const patterns = [
      /(?:completed|finished|done|analyzed|implemented|created|generated)\s+(.+?)(?=\n|$)/gi,
      /✅\s*(.+?)(?=\n|$)/gi,
      /(?:here\s+is|here's)\s+(.+?)(?=\n|$)/gi,
    ]

    const indicators: string[] = []
    for (const pattern of patterns) {
      const matches = Array.from(text.matchAll(pattern))
      indicators.push(...matches.map((m) => m[1].trim()))
    }

    return indicators
  }

  private detectWorkingIndicators(text: string): string[] {
    const patterns = [
      /(?:working\s+on|analyzing|implementing|creating|generating)\s+(.+?)(?=\n|$)/gi,
      /(?:let\s+me|i'll|i\s+will)\s+(.+?)(?=\n|$)/gi,
      /(?:now|next)\s+(?:i'll|i\s+will|let\s+me)\s+(.+?)(?=\n|$)/gi,
    ]

    const indicators: string[] = []
    for (const pattern of patterns) {
      const matches = Array.from(text.matchAll(pattern))
      indicators.push(...matches.map((m) => m[1].trim()))
    }

    return indicators
  }

  private isSubtaskMatch(subtaskDescription: string, text: string): boolean {
    const keywords = subtaskDescription
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
    const textLower = text.toLowerCase()

    // Need at least 2 keywords to match, or 1 if it's very specific
    const matchCount = keywords.filter((keyword) => textLower.includes(keyword)).length
    return matchCount >= Math.min(2, keywords.length)
  }

  private updateSubtaskStatus(task: TaskState, subtaskId: string, status: TaskStatus): void {
    const subtask = task.subtasks.find((st) => st.id === subtaskId)
    if (!subtask) return

    // Remove from current status arrays
    task.pending = task.pending.filter((id) => id !== subtaskId)
    task.inProgress = task.inProgress.filter((id) => id !== subtaskId)
    task.completed = task.completed.filter((id) => id !== subtaskId)

    // Add to new status array
    switch (status) {
      case TaskStatus.PENDING:
        task.pending.push(subtaskId)
        break
      case TaskStatus.IN_PROGRESS:
        task.inProgress.push(subtaskId)
        break
      case TaskStatus.COMPLETED:
        task.completed.push(subtaskId)
        break
    }

    subtask.status = status

    TaskTracker.log.info("updated subtask status", {
      taskId: task.id,
      subtaskId,
      status,
      description: subtask.description,
    })
  }

  private summarizeTask(task: TaskState): string {
    const words = task.originalRequest.split(/\s+/)
    if (words.length <= 10) return task.originalRequest
    return words.slice(0, 10).join(" ") + "..."
  }
}
