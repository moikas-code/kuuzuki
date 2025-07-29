import { z } from "zod"

// Error severity levels
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Error categories
export enum ErrorCategory {
  NETWORK = "network",
  AUTH = "auth",
  FILE = "file",
  SYSTEM = "system",
  VALIDATION = "validation",
  PROVIDER = "provider",
  SESSION = "session",
  TOOL = "tool",
}

// Error context interface
export interface ErrorContext {
  sessionId?: string
  userId?: string
  requestId?: string
  timestamp: number
  userAgent?: string
  path?: string
  method?: string
  stack?: string
  metadata?: Record<string, any>
}

// Base error context schema
export const ErrorContextSchema = z.object({
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  requestId: z.string().optional(),
  timestamp: z.number(),
  userAgent: z.string().optional(),
  path: z.string().optional(),
  method: z.string().optional(),
  stack: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

// Base kuuzuki error class
export abstract class KuuzukiError extends Error {
  public readonly category: ErrorCategory
  public readonly severity: ErrorSeverity
  public readonly context: ErrorContext
  public readonly code: string
  public readonly userMessage: string
  public readonly recoverable: boolean

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    code: string,
    userMessage: string,
    context: Partial<ErrorContext> = {},
    recoverable = false,
  ) {
    super(message)
    this.name = this.constructor.name
    this.category = category
    this.severity = severity
    this.code = code
    this.userMessage = userMessage
    this.recoverable = recoverable
    this.context = {
      timestamp: Date.now(),
      ...context,
    }

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      code: this.code,
      userMessage: this.userMessage,
      recoverable: this.recoverable,
      context: this.context,
      stack: this.stack,
    }
  }
}

// Network-related errors
export class NetworkError extends KuuzukiError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    context: Partial<ErrorContext> = {},
    recoverable = true,
  ) {
    super(message, ErrorCategory.NETWORK, ErrorSeverity.MEDIUM, code, userMessage, context, recoverable)
  }
}

export class ConnectionTimeoutError extends NetworkError {
  constructor(context: Partial<ErrorContext> = {}) {
    super(
      "Connection timed out",
      "NETWORK_TIMEOUT",
      "Connection timed out. Please check your internet connection and try again.",
      context,
      true,
    )
  }
}

export class RateLimitError extends NetworkError {
  constructor(retryAfter?: number, context: Partial<ErrorContext> = {}) {
    const message = retryAfter ? `Rate limit exceeded. Retry after ${retryAfter} seconds.` : "Rate limit exceeded"

    super(
      message,
      "RATE_LIMIT",
      "You've made too many requests. Please wait a moment and try again.",
      { ...context, metadata: { retryAfter } },
      true,
    )
  }
}

// Authentication errors
export class AuthError extends KuuzukiError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    context: Partial<ErrorContext> = {},
    recoverable = false,
  ) {
    super(message, ErrorCategory.AUTH, ErrorSeverity.HIGH, code, userMessage, context, recoverable)
  }
}

export class InvalidApiKeyError extends AuthError {
  constructor(provider?: string, context: Partial<ErrorContext> = {}) {
    const providerText = provider ? ` for ${provider}` : ""
    super(
      `Invalid API key${providerText}`,
      "INVALID_API_KEY",
      `Your API key${providerText} is invalid. Please check your configuration and try again.`,
      { ...context, metadata: { provider } },
      false,
    )
  }
}

export class MissingApiKeyError extends AuthError {
  constructor(provider?: string, context: Partial<ErrorContext> = {}) {
    const providerText = provider ? ` for ${provider}` : ""
    super(
      `Missing API key${providerText}`,
      "MISSING_API_KEY",
      `API key${providerText} is required. Please configure your API key and try again.`,
      { ...context, metadata: { provider } },
      false,
    )
  }
}

// File system errors
export class FileError extends KuuzukiError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    context: Partial<ErrorContext> = {},
    recoverable = false,
  ) {
    super(message, ErrorCategory.FILE, ErrorSeverity.MEDIUM, code, userMessage, context, recoverable)
  }
}

export class FileNotFoundError extends FileError {
  constructor(filePath: string, context: Partial<ErrorContext> = {}) {
    super(
      `File not found: ${filePath}`,
      "FILE_NOT_FOUND",
      `The file "${filePath}" could not be found.`,
      { ...context, metadata: { filePath } },
      false,
    )
  }
}

export class FilePermissionError extends FileError {
  constructor(filePath: string, operation: string, context: Partial<ErrorContext> = {}) {
    super(
      `Permission denied: Cannot ${operation} file ${filePath}`,
      "FILE_PERMISSION_DENIED",
      `Permission denied. Cannot ${operation} the file "${filePath}".`,
      { ...context, metadata: { filePath, operation } },
      false,
    )
  }
}

export class FileTooLargeError extends FileError {
  constructor(filePath: string, size: number, maxSize: number, context: Partial<ErrorContext> = {}) {
    super(
      `File too large: ${filePath} (${size} bytes, max: ${maxSize} bytes)`,
      "FILE_TOO_LARGE",
      `The file "${filePath}" is too large to process (${Math.round(size / 1024)}KB). Maximum size is ${Math.round(maxSize / 1024)}KB.`,
      { ...context, metadata: { filePath, size, maxSize } },
      false,
    )
  }
}

// System errors
export class SystemError extends KuuzukiError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    context: Partial<ErrorContext> = {},
    recoverable = false,
  ) {
    super(message, ErrorCategory.SYSTEM, ErrorSeverity.HIGH, code, userMessage, context, recoverable)
  }
}

export class OutOfMemoryError extends SystemError {
  constructor(context: Partial<ErrorContext> = {}) {
    super(
      "Out of memory",
      "OUT_OF_MEMORY",
      "The system is running low on memory. Please try again with a smaller request.",
      context,
      true,
    )
  }
}

export class ProcessTimeoutError extends SystemError {
  constructor(timeout: number, context: Partial<ErrorContext> = {}) {
    super(
      `Process timed out after ${timeout}ms`,
      "PROCESS_TIMEOUT",
      `The operation timed out after ${Math.round(timeout / 1000)} seconds. Please try again.`,
      { ...context, metadata: { timeout } },
      true,
    )
  }
}

// Validation errors
export class ValidationError extends KuuzukiError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    context: Partial<ErrorContext> = {},
    recoverable = true,
  ) {
    super(message, ErrorCategory.VALIDATION, ErrorSeverity.LOW, code, userMessage, context, recoverable)
  }
}

export class InvalidInputError extends ValidationError {
  constructor(field: string, reason: string, context: Partial<ErrorContext> = {}) {
    super(
      `Invalid input for field "${field}": ${reason}`,
      "INVALID_INPUT",
      `Invalid input for "${field}": ${reason}`,
      { ...context, metadata: { field, reason } },
      true,
    )
  }
}

// Provider errors
export class ProviderError extends KuuzukiError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    context: Partial<ErrorContext> = {},
    recoverable = true,
  ) {
    super(message, ErrorCategory.PROVIDER, ErrorSeverity.MEDIUM, code, userMessage, context, recoverable)
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(provider: string, context: Partial<ErrorContext> = {}) {
    super(
      `Provider ${provider} is unavailable`,
      "PROVIDER_UNAVAILABLE",
      `The AI provider "${provider}" is currently unavailable. Please try again later or switch to a different provider.`,
      { ...context, metadata: { provider } },
      true,
    )
  }
}

export class ModelNotFoundError extends ProviderError {
  constructor(model: string, provider: string, context: Partial<ErrorContext> = {}) {
    super(
      `Model ${model} not found for provider ${provider}`,
      "MODEL_NOT_FOUND",
      `The model "${model}" is not available for provider "${provider}". Please check your configuration.`,
      { ...context, metadata: { model, provider } },
      false,
    )
  }
}

// Session errors
export class SessionError extends KuuzukiError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    context: Partial<ErrorContext> = {},
    recoverable = false,
  ) {
    super(message, ErrorCategory.SESSION, ErrorSeverity.MEDIUM, code, userMessage, context, recoverable)
  }
}

export class SessionNotFoundError extends SessionError {
  constructor(sessionId: string, context: Partial<ErrorContext> = {}) {
    super(
      `Session not found: ${sessionId}`,
      "SESSION_NOT_FOUND",
      "The requested session could not be found. It may have been deleted or expired.",
      { ...context, sessionId, metadata: { sessionId } },
      false,
    )
  }
}

export class SessionExpiredError extends SessionError {
  constructor(sessionId: string, context: Partial<ErrorContext> = {}) {
    super(
      `Session expired: ${sessionId}`,
      "SESSION_EXPIRED",
      "Your session has expired. Please start a new session.",
      { ...context, sessionId, metadata: { sessionId } },
      false,
    )
  }
}

// Tool errors
export class ToolError extends KuuzukiError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    context: Partial<ErrorContext> = {},
    recoverable = true,
  ) {
    super(message, ErrorCategory.TOOL, ErrorSeverity.MEDIUM, code, userMessage, context, recoverable)
  }
}

export class ToolNotFoundError extends ToolError {
  constructor(toolName: string, context: Partial<ErrorContext> = {}) {
    super(
      `Tool not found: ${toolName}`,
      "TOOL_NOT_FOUND",
      `The requested tool "${toolName}" is not available.`,
      { ...context, metadata: { toolName } },
      false,
    )
  }
}

export class ToolExecutionError extends ToolError {
  constructor(toolName: string, reason: string, context: Partial<ErrorContext> = {}) {
    super(
      `Tool execution failed: ${toolName} - ${reason}`,
      "TOOL_EXECUTION_FAILED",
      `Failed to execute tool "${toolName}": ${reason}`,
      { ...context, metadata: { toolName, reason } },
      true,
    )
  }
}

// Error type guards
export function isKuuzukiError(error: any): error is KuuzukiError {
  return error instanceof KuuzukiError
}

export function isNetworkError(error: any): error is NetworkError {
  return error instanceof NetworkError
}

export function isAuthError(error: any): error is AuthError {
  return error instanceof AuthError
}

export function isFileError(error: any): error is FileError {
  return error instanceof FileError
}

export function isSystemError(error: any): error is SystemError {
  return error instanceof SystemError
}

export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError
}

export function isProviderError(error: any): error is ProviderError {
  return error instanceof ProviderError
}

export function isSessionError(error: any): error is SessionError {
  return error instanceof SessionError
}

export function isToolError(error: any): error is ToolError {
  return error instanceof ToolError
}
