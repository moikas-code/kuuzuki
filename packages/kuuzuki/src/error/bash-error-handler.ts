import { Log } from "../util/log"
import { ErrorHandler } from "./handler"
import { 
  KuuzukiError, 
  SystemError, 
  ProcessTimeoutError,
  FilePermissionError,
  ValidationError
} from "./types"
import { ErrorRecoveryManager } from "./recovery"

const log = Log.create({ service: "bash-error-handler" })

export interface BashExecutionContext {
  command: string
  timeout: number
  cwd: string
  sessionId?: string
  toolCallId?: string
  description?: string
}

export interface BashExecutionResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  signal?: string
  error?: KuuzukiError
  truncated: {
    stdout: boolean
    stderr: boolean
  }
  performance: {
    startTime: number
    endTime: number
    duration: number
    memoryUsage?: NodeJS.MemoryUsage
  }
}

export class BashErrorHandler {
  private static readonly DANGEROUS_COMMANDS = [
    'rm -rf /',
    'dd if=',
    'mkfs',
    'fdisk',
    'format',
    ':(){ :|:& };:',  // Fork bomb
    'sudo rm',
    'chmod 777 /',
    'chown -R'
  ]

  private static readonly RESOURCE_INTENSIVE_COMMANDS = [
    'find /',
    'grep -r',
    'tar -',
    'zip -r',
    'rsync',
    'dd',
    'sort',
    'uniq'
  ]

  /**
   * Validate command before execution
   */
  static validateCommand(context: BashExecutionContext): KuuzukiError | null {
    const { command } = context

    // Check for empty command
    if (!command.trim()) {
      return new ValidationError(
        "Empty command",
        "BASH_EMPTY_COMMAND",
        "Command cannot be empty",
        { sessionId: context.sessionId, metadata: { command } }
      )
    }

    // Check for dangerous commands
    for (const dangerous of this.DANGEROUS_COMMANDS) {
      if (command.toLowerCase().includes(dangerous.toLowerCase())) {
        return new ValidationError(
          `Dangerous command detected: ${dangerous}`,
          "BASH_DANGEROUS_COMMAND",
          `This command contains potentially dangerous operations: ${dangerous}`,
          { 
            sessionId: context.sessionId, 
            metadata: { command, dangerousPattern: dangerous } 
          }
        )
      }
    }

    // Check for command injection patterns
    const injectionPatterns = [
      /;\s*rm\s+/,
      /\|\s*rm\s+/,
      /&&\s*rm\s+/,
      /`.*rm.*`/,
      /\$\(.*rm.*\)/,
      /;\s*curl\s+.*\|\s*sh/,
      /;\s*wget\s+.*\|\s*sh/
    ]

    for (const pattern of injectionPatterns) {
      if (pattern.test(command)) {
        return new ValidationError(
          `Command injection pattern detected`,
          "BASH_INJECTION_DETECTED",
          "This command contains patterns that could be used for command injection",
          { 
            sessionId: context.sessionId, 
            metadata: { command, pattern: pattern.source } 
          }
        )
      }
    }

    // Validate timeout
    if (context.timeout < 0 || context.timeout > 10 * 60 * 1000) {
      return new ValidationError(
        `Invalid timeout: ${context.timeout}`,
        "BASH_INVALID_TIMEOUT",
        "Timeout must be between 0 and 10 minutes",
        { sessionId: context.sessionId, metadata: { timeout: context.timeout } }
      )
    }

    return null
  }

  /**
   * Handle bash execution with comprehensive error handling
   */
  static async executeWithErrorHandling(
    context: BashExecutionContext,
    executor: () => Promise<any>
  ): Promise<BashExecutionResult> {
    const startTime = Date.now()
    let memoryBefore: NodeJS.MemoryUsage | undefined

    try {
      // Capture initial memory usage
      if (process.memoryUsage) {
        memoryBefore = process.memoryUsage()
      }

      // Validate command first
      const validationError = this.validateCommand(context)
      if (validationError) {
        return {
          success: false,
          stdout: "",
          stderr: validationError.userMessage,
          exitCode: -1,
          error: validationError,
          truncated: { stdout: false, stderr: false },
          performance: {
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            memoryUsage: memoryBefore
          }
        }
      }

      // Check if command is resource intensive
      const isResourceIntensive = this.RESOURCE_INTENSIVE_COMMANDS.some(
        pattern => context.command.toLowerCase().includes(pattern.toLowerCase())
      )

      if (isResourceIntensive) {
        log.warn("Executing resource-intensive command", {
          command: context.command,
          sessionId: context.sessionId
        })
      }

      // Execute with recovery
      const result = await ErrorRecoveryManager.executeWithRecovery(
        executor,
        {
          operation: "bash_execution",
          toolName: "bash",
          sessionId: context.sessionId,
          maxAttempts: isResourceIntensive ? 1 : 2 // Don't retry resource-intensive commands
        }
      )

      const endTime = Date.now()
      const memoryAfter = process.memoryUsage?.()

      if (result.success && result.result) {
        return {
          success: true,
          stdout: result.result.stdout || "",
          stderr: result.result.stderr || "",
          exitCode: result.result.exitCode || 0,
          signal: result.result.signal,
          truncated: result.result.truncated || { stdout: false, stderr: false },
          performance: {
            startTime,
            endTime,
            duration: endTime - startTime,
            memoryUsage: memoryAfter
          }
        }
      } else {
        return {
          success: false,
          stdout: "",
          stderr: result.error?.userMessage || "Unknown error",
          exitCode: -1,
          error: result.error,
          truncated: { stdout: false, stderr: false },
          performance: {
            startTime,
            endTime,
            duration: endTime - startTime,
            memoryUsage: memoryAfter
          }
        }
      }
    } catch (error) {
      const endTime = Date.now()
      const handledError = this.handleBashError(error, context)

      return {
        success: false,
        stdout: "",
        stderr: handledError.userMessage,
        exitCode: -1,
        error: handledError,
        truncated: { stdout: false, stderr: false },
        performance: {
          startTime,
          endTime,
          duration: endTime - startTime,
          memoryUsage: memoryBefore
        }
      }
    }
  }

  /**
   * Handle specific bash execution errors
   */
  private static handleBashError(error: unknown, context: BashExecutionContext): KuuzukiError {
    const errorContext = {
      sessionId: context.sessionId,
      metadata: {
        command: context.command,
        timeout: context.timeout,
        cwd: context.cwd,
        description: context.description
      }
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      // Timeout errors
      if (message.includes('timeout') || message.includes('killed')) {
        return new ProcessTimeoutError(context.timeout, errorContext)
      }

      // Permission errors
      if (message.includes('permission denied') || message.includes('eacces')) {
        return new FilePermissionError(
          context.cwd,
          "execute command",
          errorContext
        )
      }

      // Command not found
      if (message.includes('command not found') || message.includes('enoent')) {
        const commandName = context.command.split(' ')[0]
        return new ValidationError(
          `Command not found: ${commandName}`,
          "BASH_COMMAND_NOT_FOUND",
          `The command "${commandName}" was not found. Please check if it's installed and in your PATH.`,
          errorContext
        )
      }

      // Memory errors
      if (message.includes('out of memory') || message.includes('cannot allocate')) {
        return new SystemError(
          "Out of memory during command execution",
          "BASH_OUT_OF_MEMORY",
          "The system ran out of memory while executing the command. Try a smaller operation or restart the session.",
          errorContext
        )
      }

      // Disk space errors
      if (message.includes('no space left') || message.includes('enospc')) {
        return new SystemError(
          "No space left on device",
          "BASH_NO_SPACE",
          "There is no space left on the device. Please free up some space and try again.",
          errorContext
        )
      }

      // Signal errors (SIGKILL, SIGTERM, etc.)
      if (message.includes('signal') || message.includes('sig')) {
        return new ProcessTimeoutError(context.timeout, {
          ...errorContext,
          metadata: {
            ...errorContext.metadata,
            signal: this.extractSignal(message)
          }
        })
      }
    }

    // Default error handling
    return ErrorHandler.handle(error, errorContext)
  }

  /**
   * Extract signal name from error message
   */
  private static extractSignal(message: string): string | undefined {
    const signalMatch = message.match(/sig(\w+)/i)
    return signalMatch ? signalMatch[1].toUpperCase() : undefined
  }

  /**
   * Monitor bash execution for resource usage
   */
  static monitorExecution(context: BashExecutionContext): {
    checkMemory: () => boolean
    checkTimeout: () => boolean
    getStats: () => any
  } {
    const startTime = Date.now()
    const initialMemory = process.memoryUsage?.()

    return {
      checkMemory: () => {
        if (!process.memoryUsage) return true
        
        const current = process.memoryUsage()
        const memoryIncrease = current.heapUsed - (initialMemory?.heapUsed || 0)
        
        // Alert if memory usage increased by more than 100MB
        if (memoryIncrease > 100 * 1024 * 1024) {
          log.warn("High memory usage detected during bash execution", {
            command: context.command,
            memoryIncrease: Math.round(memoryIncrease / 1024 / 1024),
            sessionId: context.sessionId
          })
          return false
        }
        
        return true
      },

      checkTimeout: () => {
        const elapsed = Date.now() - startTime
        const remaining = context.timeout - elapsed
        
        if (remaining < 5000) { // 5 seconds warning
          log.warn("Command approaching timeout", {
            command: context.command,
            elapsed: Math.round(elapsed / 1000),
            remaining: Math.round(remaining / 1000),
            sessionId: context.sessionId
          })
        }
        
        return remaining > 0
      },

      getStats: () => ({
        elapsed: Date.now() - startTime,
        memoryUsage: process.memoryUsage?.(),
        command: context.command,
        sessionId: context.sessionId
      })
    }
  }

  /**
   * Sanitize command output for security
   */
  static sanitizeOutput(output: string, context: BashExecutionContext): string {
    let sanitized = output

    // Remove potential secrets (basic patterns)
    const secretPatterns = [
      /([A-Za-z0-9+/]{40,}={0,2})/g, // Base64-like strings
      /(sk-[A-Za-z0-9]{48})/g, // OpenAI API keys
      /(xoxb-[A-Za-z0-9-]+)/g, // Slack tokens
      /(ghp_[A-Za-z0-9]{36})/g, // GitHub tokens
      /(AKIA[A-Z0-9]{16})/g, // AWS access keys
    ]

    for (const pattern of secretPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]')
    }

    // Remove absolute paths that might contain sensitive info
    sanitized = sanitized.replace(/\/home\/[^\/\s]+/g, '/home/[USER]')
    sanitized = sanitized.replace(/\/Users\/[^\/\s]+/g, '/Users/[USER]')

    return sanitized
  }
}