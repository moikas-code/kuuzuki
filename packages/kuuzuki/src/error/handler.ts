import { Log } from "../util/log"
import { Bus } from "../bus"
import {
  KuuzukiError,
  ErrorSeverity,
  ErrorCategory,
  NetworkError,
  AuthError,
  FileError,
  SystemError,
  ValidationError,
  ProviderError,
  SessionError,
  ToolError,
  ConnectionTimeoutError,
  RateLimitError,
  isKuuzukiError,
} from "./types"
import type { ErrorContext } from "./types"

export interface ErrorRecoveryStrategy {
  canRecover: boolean
  retryable: boolean
  retryDelay?: number
  maxRetries?: number
  fallbackAction?: () => Promise<void>
  userAction?: string
}

export interface ErrorHandlerOptions {
  logErrors: boolean
  emitEvents: boolean
  includeStackTrace: boolean
  sanitizeContext: boolean
}

export class ErrorHandler {
  private static readonly log = Log.create({ service: "error-handler" })
  private static readonly defaultOptions: ErrorHandlerOptions = {
    logErrors: true,
    emitEvents: true,
    includeStackTrace: true,
    sanitizeContext: true,
  }

  /**
   * Handle any error and convert it to a standardized format
   */
  static handle(
    error: unknown,
    context: Partial<ErrorContext> = {},
    options: Partial<ErrorHandlerOptions> = {},
  ): KuuzukiError {
    const opts = { ...this.defaultOptions, ...options }

    let kuuzukiError: KuuzukiError

    if (isKuuzukiError(error)) {
      kuuzukiError = error
      // Merge additional context
      Object.assign(kuuzukiError.context, context)
    } else {
      kuuzukiError = this.convertToKuuzukiError(error, context)
    }

    // Sanitize context if requested
    if (opts.sanitizeContext) {
      Object.assign(kuuzukiError.context, this.sanitizeContext(kuuzukiError.context))
    }

    // Log the error
    if (opts.logErrors) {
      this.logError(kuuzukiError, opts.includeStackTrace)
    }

    // Emit error event
    if (opts.emitEvents) {
      this.emitErrorEvent(kuuzukiError)
    }

    return kuuzukiError
  }

  /**
   * Convert unknown error to KuuzukiError
   */
  private static convertToKuuzukiError(error: unknown, context: Partial<ErrorContext>): KuuzukiError {
    if (error instanceof Error) {
      // Try to categorize based on error message/type
      const category = this.categorizeError(error)
      const code = this.generateErrorCode(error, category)
      const userMessage = this.generateUserMessage(error, category)

      const ErrorClass = this.getErrorClass(category)
      return new ErrorClass(
        error.message,
        code,
        userMessage,
        { ...context, stack: error.stack },
        this.isRecoverable(error, category),
      )
    }

    // Handle non-Error objects
    const message = typeof error === "string" ? error : JSON.stringify(error)
    return new SystemError(
      `Unknown error: ${message}`,
      "UNKNOWN_ERROR",
      "An unexpected error occurred. Please try again.",
      context,
      false,
    )
  }

  /**
   * Categorize error based on its properties
   */
  private static categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()

    // Network errors
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("fetch") ||
      name.includes("network") ||
      name.includes("timeout")
    ) {
      return ErrorCategory.NETWORK
    }

    // Auth errors
    if (
      message.includes("unauthorized") ||
      message.includes("authentication") ||
      message.includes("api key") ||
      message.includes("token") ||
      name.includes("auth")
    ) {
      return ErrorCategory.AUTH
    }

    // File errors
    if (
      message.includes("file") ||
      message.includes("directory") ||
      message.includes("path") ||
      message.includes("enoent") ||
      message.includes("eacces") ||
      name.includes("file")
    ) {
      return ErrorCategory.FILE
    }

    // Validation errors
    if (
      message.includes("validation") ||
      message.includes("invalid") ||
      message.includes("schema") ||
      name.includes("validation") ||
      name.includes("zod")
    ) {
      return ErrorCategory.VALIDATION
    }

    // Provider errors
    if (
      message.includes("provider") ||
      message.includes("model") ||
      message.includes("anthropic") ||
      message.includes("openai")
    ) {
      return ErrorCategory.PROVIDER
    }

    // Session errors
    if (message.includes("session") || message.includes("expired")) {
      return ErrorCategory.SESSION
    }

    // Tool errors
    if (message.includes("tool") || message.includes("execution")) {
      return ErrorCategory.TOOL
    }

    // Default to system error
    return ErrorCategory.SYSTEM
  }

  /**
   * Generate error code
   */
  private static generateErrorCode(error: Error, category: ErrorCategory): string {
    const categoryPrefix = category.toUpperCase()
    const name = error.name.toUpperCase().replace("ERROR", "")
    return `${categoryPrefix}_${name || "UNKNOWN"}`
  }

  /**
   * Generate user-friendly message
   */
  private static generateUserMessage(error: Error, category: ErrorCategory): string {
    const message = error.message

    switch (category) {
      case ErrorCategory.NETWORK:
        return "Network error occurred. Please check your connection and try again."
      case ErrorCategory.AUTH:
        return "Authentication failed. Please check your credentials."
      case ErrorCategory.FILE:
        return `File operation failed: ${message}`
      case ErrorCategory.VALIDATION:
        return `Invalid input: ${message}`
      case ErrorCategory.PROVIDER:
        return "AI provider error. Please try again or switch providers."
      case ErrorCategory.SESSION:
        return "Session error. Please refresh and try again."
      case ErrorCategory.TOOL:
        return `Tool execution failed: ${message}`
      default:
        return "An unexpected error occurred. Please try again."
    }
  }

  /**
   * Get appropriate error class for category
   */
  private static getErrorClass(category: ErrorCategory) {
    switch (category) {
      case ErrorCategory.NETWORK:
        return NetworkError
      case ErrorCategory.AUTH:
        return AuthError
      case ErrorCategory.FILE:
        return FileError
      case ErrorCategory.VALIDATION:
        return ValidationError
      case ErrorCategory.PROVIDER:
        return ProviderError
      case ErrorCategory.SESSION:
        return SessionError
      case ErrorCategory.TOOL:
        return ToolError
      default:
        return SystemError
    }
  }

  /**
   * Determine if error is recoverable
   */
  private static isRecoverable(error: Error, category: ErrorCategory): boolean {
    const message = error.message.toLowerCase()

    // Non-recoverable conditions
    if (
      message.includes("permission denied") ||
      message.includes("access denied") ||
      message.includes("not found") ||
      message.includes("invalid api key") ||
      category === ErrorCategory.AUTH
    ) {
      return false
    }

    // Recoverable by default for network, validation, and tool errors
    return [ErrorCategory.NETWORK, ErrorCategory.VALIDATION, ErrorCategory.TOOL, ErrorCategory.PROVIDER].includes(
      category,
    )
  }

  /**
   * Get recovery strategy for an error
   */
  static getRecoveryStrategy(error: KuuzukiError): ErrorRecoveryStrategy {
    const baseStrategy: ErrorRecoveryStrategy = {
      canRecover: error.recoverable,
      retryable: false,
    }

    if (!error.recoverable) {
      return baseStrategy
    }

    switch (error.category) {
      case ErrorCategory.NETWORK:
        if (error instanceof ConnectionTimeoutError) {
          return {
            ...baseStrategy,
            retryable: true,
            retryDelay: 1000,
            maxRetries: 3,
            userAction: "Check your internet connection",
          }
        }
        if (error instanceof RateLimitError) {
          const retryAfter = error.context.metadata?.["retryAfter"] || 60
          return {
            ...baseStrategy,
            retryable: true,
            retryDelay: retryAfter * 1000,
            maxRetries: 1,
            userAction: `Wait ${retryAfter} seconds before retrying`,
          }
        }
        return {
          ...baseStrategy,
          retryable: true,
          retryDelay: 2000,
          maxRetries: 2,
        }

      case ErrorCategory.PROVIDER:
        return {
          ...baseStrategy,
          retryable: true,
          retryDelay: 5000,
          maxRetries: 2,
          userAction: "Try switching to a different AI provider",
        }

      case ErrorCategory.TOOL:
        return {
          ...baseStrategy,
          retryable: true,
          retryDelay: 1000,
          maxRetries: 1,
        }

      case ErrorCategory.VALIDATION:
        return {
          ...baseStrategy,
          retryable: false,
          userAction: "Please correct the input and try again",
        }

      default:
        return baseStrategy
    }
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private static sanitizeContext(context: ErrorContext): ErrorContext {
    const sanitized = { ...context }

    // Remove sensitive fields from metadata
    if (sanitized.metadata) {
      const sensitiveKeys = ["password", "token", "key", "secret", "auth"]
      sanitized.metadata = Object.fromEntries(
        Object.entries(sanitized.metadata).filter(
          ([key]) => !sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive)),
        ),
      )
    }

    return sanitized
  }

  /**
   * Log error with appropriate level
   */
  private static logError(error: KuuzukiError, includeStack: boolean) {
    const logData = {
      category: error.category,
      severity: error.severity,
      code: error.code,
      context: error.context,
      ...(includeStack && { stack: error.stack }),
    }

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.log.error(`CRITICAL: ${error.message}`, logData)
        break
      case ErrorSeverity.HIGH:
        this.log.error(`HIGH: ${error.message}`, logData)
        break
      case ErrorSeverity.MEDIUM:
        this.log.warn(`MEDIUM: ${error.message}`, logData)
        break
      case ErrorSeverity.LOW:
        this.log.info(`LOW: ${error.message}`, logData)
        break
    }
  }

  /**
   * Emit error event through the bus
   */
  private static emitErrorEvent(error: KuuzukiError) {
    Bus.publish({
      type: "error.occurred",
      properties: {
        error: error.toJSON(),
        timestamp: Date.now(),
      },
    })
  }

  /**
   * Create error context from HTTP request
   */
  static createHttpContext(req: any): Partial<ErrorContext> {
    return {
      path: req.path,
      method: req.method,
      userAgent: req.header("user-agent"),
      requestId: req.header("x-request-id") || crypto.randomUUID(),
    }
  }

  /**
   * Format error for HTTP response
   */
  static formatForHttp(error: KuuzukiError) {
    return {
      error: {
        code: error.code,
        message: error.userMessage,
        category: error.category,
        severity: error.severity,
        recoverable: error.recoverable,
        context: {
          requestId: error.context.requestId,
          timestamp: error.context.timestamp,
        },
      },
    }
  }

  /**
   * Get HTTP status code for error
   */
  static getHttpStatusCode(error: KuuzukiError): number {
    switch (error.category) {
      case ErrorCategory.AUTH:
        return 401
      case ErrorCategory.VALIDATION:
        return 400
      case ErrorCategory.FILE:
        if (error.code === "FILE_NOT_FOUND") return 404
        if (error.code === "FILE_PERMISSION_DENIED") return 403
        return 400
      case ErrorCategory.NETWORK:
        if (error instanceof RateLimitError) return 429
        return 503
      case ErrorCategory.PROVIDER:
        return 503
      case ErrorCategory.SESSION:
        if (error.code === "SESSION_NOT_FOUND") return 404
        return 400
      case ErrorCategory.TOOL:
        return 400
      case ErrorCategory.SYSTEM:
        return 500
      default:
        return 500
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retry<T>(operation: () => Promise<T>, error: KuuzukiError, attempt = 1): Promise<T> {
    const strategy = this.getRecoveryStrategy(error)

    if (!strategy.retryable || !strategy.maxRetries || attempt > strategy.maxRetries) {
      throw error
    }

    const delay = (strategy.retryDelay || 1000) * Math.pow(2, attempt - 1)

    this.log.info(`Retrying operation (attempt ${attempt}/${strategy.maxRetries}) after ${delay}ms`, {
      error: error.code,
      attempt,
      delay,
    })

    await new Promise((resolve) => setTimeout(resolve, delay))

    try {
      return await operation()
    } catch (retryError) {
      const handledError = this.handle(retryError)
      return this.retry(operation, handledError, attempt + 1)
    }
  }
}
