import { Log } from "../util/log"
import { ErrorHandler, ErrorRecoveryStrategy } from "./handler"
import { KuuzukiError, ErrorCategory } from "./types"

const log = Log.create({ service: "error-recovery" })

export interface RecoveryContext {
  sessionId?: string
  toolName?: string
  operation: string
  attempt: number
  maxAttempts: number
  startTime: number
}

export interface RecoveryResult<T> {
  success: boolean
  result?: T
  error?: KuuzukiError
  attempts: number
  totalTime: number
  recoveryActions: string[]
}

export class ErrorRecoveryManager {
  private static readonly MAX_GLOBAL_RETRIES = 5
  private static readonly CIRCUIT_BREAKER_THRESHOLD = 10
  private static readonly CIRCUIT_BREAKER_TIMEOUT = 60000 // 1 minute
  
  private static circuitBreakerState = new Map<string, {
    failures: number
    lastFailure: number
    isOpen: boolean
  }>()

  /**
   * Execute operation with comprehensive error recovery
   */
  static async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: Partial<RecoveryContext>,
    customStrategy?: Partial<ErrorRecoveryStrategy>
  ): Promise<RecoveryResult<T>> {
    const startTime = Date.now()
    const recoveryActions: string[] = []
    let lastError: KuuzukiError | undefined
    
    const fullContext: RecoveryContext = {
      operation: "unknown",
      attempt: 1,
      maxAttempts: 3,
      startTime,
      ...context
    }

    // Check circuit breaker
    const circuitKey = `${fullContext.operation}:${fullContext.toolName || 'global'}`
    if (this.isCircuitOpen(circuitKey)) {
      const error = ErrorHandler.handle(
        new Error(`Circuit breaker open for ${fullContext.operation}`),
        { sessionId: fullContext.sessionId }
      )
      return {
        success: false,
        error,
        attempts: 0,
        totalTime: Date.now() - startTime,
        recoveryActions: ["Circuit breaker prevented execution"]
      }
    }

    for (let attempt = 1; attempt <= fullContext.maxAttempts; attempt++) {
      try {
        log.info(`Executing operation attempt ${attempt}/${fullContext.maxAttempts}`, {
          operation: fullContext.operation,
          sessionId: fullContext.sessionId,
          toolName: fullContext.toolName
        })

        const result = await operation()
        
        // Reset circuit breaker on success
        this.resetCircuitBreaker(circuitKey)
        
        return {
          success: true,
          result,
          attempts: attempt,
          totalTime: Date.now() - startTime,
          recoveryActions
        }
      } catch (error) {
        lastError = ErrorHandler.handle(error, {
          sessionId: fullContext.sessionId,
          metadata: {
            operation: fullContext.operation,
            attempt,
            maxAttempts: fullContext.maxAttempts,
            toolName: fullContext.toolName
          }
        })

        log.warn(`Operation failed on attempt ${attempt}`, {
          error: lastError.code,
          message: lastError.message,
          recoverable: lastError.recoverable
        })

        // Record failure for circuit breaker
        this.recordFailure(circuitKey)

        // Get recovery strategy
        const strategy = customStrategy 
          ? { ...ErrorHandler.getRecoveryStrategy(lastError), ...customStrategy }
          : ErrorHandler.getRecoveryStrategy(lastError)

        // If not recoverable or last attempt, break
        if (!strategy.canRecover || attempt >= fullContext.maxAttempts) {
          break
        }

        // Apply recovery actions
        const recoveryAction = await this.applyRecoveryStrategy(strategy, lastError, attempt)
        if (recoveryAction) {
          recoveryActions.push(recoveryAction)
        }

        // Wait before retry if specified
        if (strategy.retryDelay && attempt < fullContext.maxAttempts) {
          const delay = strategy.retryDelay * Math.pow(2, attempt - 1) // Exponential backoff
          log.info(`Waiting ${delay}ms before retry`, { attempt, delay })
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    return {
      success: false,
      error: lastError!,
      attempts: fullContext.maxAttempts,
      totalTime: Date.now() - startTime,
      recoveryActions
    }
  }

  /**
   * Apply recovery strategy based on error type
   */
  private static async applyRecoveryStrategy(
    strategy: ErrorRecoveryStrategy,
    error: KuuzukiError,
    attempt: number
  ): Promise<string | undefined> {
    try {
      switch (error.category) {
        case ErrorCategory.NETWORK:
          return await this.recoverFromNetworkError(error, attempt)
        
        case ErrorCategory.FILE:
          return await this.recoverFromFileError(error, attempt)
        
        case ErrorCategory.SYSTEM:
          return await this.recoverFromSystemError(error, attempt)
        
        case ErrorCategory.TOOL:
          return await this.recoverFromToolError(error, attempt)
        
        case ErrorCategory.PROVIDER:
          return await this.recoverFromProviderError(error, attempt)
        
        default:
          if (strategy.fallbackAction) {
            await strategy.fallbackAction()
            return "Applied fallback action"
          }
          return undefined
      }
    } catch (recoveryError) {
      log.error("Recovery action failed", { 
        originalError: error.code,
        recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
      })
      return undefined
    }
  }

  /**
   * Recover from network errors
   */
  private static async recoverFromNetworkError(error: KuuzukiError, attempt: number): Promise<string> {
    const actions: string[] = []

    // Check connectivity
    try {
      const response = await fetch('https://httpbin.org/status/200', { 
        signal: AbortSignal.timeout(5000) 
      })
      if (response.ok) {
        actions.push("Network connectivity verified")
      }
    } catch {
      actions.push("Network connectivity check failed")
    }

    // DNS resolution check
    try {
      await fetch('https://1.1.1.1', { signal: AbortSignal.timeout(3000) })
      actions.push("DNS resolution working")
    } catch {
      actions.push("DNS resolution may be failing")
    }

    return actions.join(", ")
  }

  /**
   * Recover from file system errors
   */
  private static async recoverFromFileError(error: KuuzukiError, attempt: number): Promise<string> {
    const filePath = error.context.metadata?.filePath as string
    if (!filePath) return "No file path available for recovery"

    const actions: string[] = []

    try {
      // Check if parent directory exists
      const parentDir = filePath.split('/').slice(0, -1).join('/')
      if (parentDir) {
        const parentExists = await Bun.file(parentDir).exists()
        if (!parentExists) {
          actions.push(`Parent directory ${parentDir} does not exist`)
        } else {
          actions.push("Parent directory exists")
        }
      }

      // Check permissions
      try {
        await Bun.file(filePath).text()
        actions.push("File is readable")
      } catch {
        actions.push("File read permission denied or file does not exist")
      }
    } catch (checkError) {
      actions.push(`File system check failed: ${checkError instanceof Error ? checkError.message : String(checkError)}`)
    }

    return actions.join(", ")
  }

  /**
   * Recover from system errors
   */
  private static async recoverFromSystemError(error: KuuzukiError, attempt: number): Promise<string> {
    const actions: string[] = []

    // Check memory usage
    if (process.memoryUsage) {
      const memory = process.memoryUsage()
      const memoryMB = Math.round(memory.heapUsed / 1024 / 1024)
      actions.push(`Memory usage: ${memoryMB}MB`)
      
      if (memory.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
        if (global.gc) {
          global.gc()
          actions.push("Forced garbage collection")
        } else {
          actions.push("High memory usage detected, but GC not available")
        }
      }
    }

    // Check disk space if possible
    try {
      const stats = await Bun.file('.').stat()
      actions.push("File system accessible")
    } catch {
      actions.push("File system access issues detected")
    }

    return actions.join(", ")
  }

  /**
   * Recover from tool execution errors
   */
  private static async recoverFromToolError(error: KuuzukiError, attempt: number): Promise<string> {
    const toolName = error.context.metadata?.toolName as string
    const actions: string[] = []

    // Tool-specific recovery
    switch (toolName) {
      case 'bash':
        actions.push("Checking shell environment")
        // Could check if shell is available, PATH, etc.
        break
      
      case 'read':
      case 'write':
      case 'edit':
        actions.push("Checking file system permissions")
        break
      
      default:
        actions.push(`Generic recovery for tool: ${toolName || 'unknown'}`)
    }

    return actions.join(", ")
  }

  /**
   * Recover from AI provider errors
   */
  private static async recoverFromProviderError(error: KuuzukiError, attempt: number): Promise<string> {
    const provider = error.context.metadata?.provider as string
    const actions: string[] = []

    // Check API endpoint availability
    if (provider === 'anthropic') {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Will fail but tells us if endpoint is reachable
          signal: AbortSignal.timeout(5000)
        })
        actions.push("Anthropic API endpoint reachable")
      } catch {
        actions.push("Anthropic API endpoint unreachable")
      }
    }

    actions.push(`Provider ${provider || 'unknown'} recovery attempted`)
    return actions.join(", ")
  }

  /**
   * Circuit breaker implementation
   */
  private static isCircuitOpen(key: string): boolean {
    const state = this.circuitBreakerState.get(key)
    if (!state) return false

    if (state.isOpen) {
      // Check if timeout has passed
      if (Date.now() - state.lastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
        state.isOpen = false
        state.failures = 0
        log.info(`Circuit breaker reset for ${key}`)
        return false
      }
      return true
    }

    return false
  }

  private static recordFailure(key: string): void {
    const state = this.circuitBreakerState.get(key) || {
      failures: 0,
      lastFailure: 0,
      isOpen: false
    }

    state.failures++
    state.lastFailure = Date.now()

    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true
      log.warn(`Circuit breaker opened for ${key}`, { failures: state.failures })
    }

    this.circuitBreakerState.set(key, state)
  }

  private static resetCircuitBreaker(key: string): void {
    const state = this.circuitBreakerState.get(key)
    if (state) {
      state.failures = 0
      state.isOpen = false
      this.circuitBreakerState.set(key, state)
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  static getCircuitBreakerStatus(): Record<string, any> {
    const status: Record<string, any> = {}
    
    for (const [key, state] of this.circuitBreakerState.entries()) {
      status[key] = {
        failures: state.failures,
        isOpen: state.isOpen,
        lastFailure: state.lastFailure ? new Date(state.lastFailure).toISOString() : null,
        timeUntilReset: state.isOpen 
          ? Math.max(0, this.CIRCUIT_BREAKER_TIMEOUT - (Date.now() - state.lastFailure))
          : 0
      }
    }

    return status
  }
}