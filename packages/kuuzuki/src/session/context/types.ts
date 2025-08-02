import { MessageV2 } from "../message-v2"

export interface TaskState {
  id: string
  originalRequest: string
  subtasks: SubTask[]
  completed: string[]
  inProgress: string[]
  pending: string[]
  estimatedTokens: number
  priority: TaskPriority
  createdAt: number
  lastUpdated: number
}

export interface SubTask {
  id: string
  description: string
  status: TaskStatus
  estimatedTokens: number
  dependencies: string[]
  messageIds: string[]
}

export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
}

export enum TaskPriority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export enum MessageImportance {
  CRITICAL = 0.95, // Task definitions, errors
  HIGH = 0.8, // Tool outputs, important results
  MEDIUM = 0.6, // Recent context, user questions
  LOW = 0.3, // General chat, old context
  MINIMAL = 0.1, // Noise, redundant info
}

export interface MessageClassification {
  importance: MessageImportance
  isTaskRelated: boolean
  isToolOutput: boolean
  isError: boolean
  isUserRequest: boolean
  containsResults: boolean
  taskIds: string[]
  preserveReason: string
}

export interface ContextCompactionResult {
  trimmedMessages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }>
  preservedTasks: TaskState[]
  continuationPrompt: string | null
  tokensRemoved: number
  tokensPreserved: number
  preservationRatio: number
  compactionStrategy: string
}

export interface ContextCompactionOptions {
  maxTokens: number
  safetyMargin: number
  preserveTaskContext: boolean
  preserveToolOutputs: boolean
  preserveErrors: boolean
  minRecentMessages: number
  taskContinuationPrompts: boolean
}

export interface TaskPattern {
  pattern: RegExp
  priority: TaskPriority
  description: string
  extractSubtasks: (match: RegExpMatchArray, fullText: string) => SubTask[]
}

export interface ContextMetrics {
  totalMessages: number
  totalTokens: number
  taskMessages: number
  toolOutputMessages: number
  errorMessages: number
  averageImportance: number
  preservationEfficiency: number
}
