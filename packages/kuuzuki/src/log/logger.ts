import { getErrorCode } from "../util/error-types";
import { z } from "zod"
import { extendZodWithOpenApi } from "zod-openapi"
import { Transport } from "./transport"
import { Metrics } from "./metrics"

extendZodWithOpenApi(z)

export namespace Logger {
  // Log levels with priority ordering
  export const Level = z.enum(["debug", "info", "warn", "error", "fatal"]).openapi({
    ref: "LogLevel",
    description: "Log level indicating severity",
  })
  export type Level = z.infer<typeof Level>

  const levelPriority: Record<Level, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  }

  // Log entry structure
  export const LogEntry = z
    .object({
      timestamp: z.string().describe("ISO timestamp of the log entry"),
      level: Level.describe("Log level"),
      message: z.string().describe("Log message"),
      service: z.string().describe("Service or component name"),
      context: z.record(z.string(), z.any()).optional().describe("Additional context data"),
      error: z
        .object({
          name: z.string(),
          message: z.string(),
          stack: z.string().optional(),
          code: z.string().optional(),
        })
        .optional()
        .describe("Error details if applicable"),
      performance: z
        .object({
          duration: z.number().describe("Operation duration in milliseconds"),
          memory: z.number().optional().describe("Memory usage in bytes"),
          cpu: z.number().optional().describe("CPU usage percentage"),
        })
        .optional()
        .describe("Performance metrics"),
      traceId: z.string().optional().describe("Trace ID for request correlation"),
      sessionId: z.string().optional().describe("Session ID for user correlation"),
    })
    .strict()
    .openapi({
      ref: "LogEntry",
    })
  export type LogEntry = z.infer<typeof LogEntry>

  // Logger configuration
  export const LoggerConfig = z
    .object({
      level: Level.default("info").describe("Minimum log level to output"),
      service: z.string().describe("Service name for this logger instance"),
      context: z.record(z.string(), z.any()).optional().describe("Default context to include in all logs"),
      enablePerformanceTracking: z.boolean().default(true).describe("Enable automatic performance tracking"),
      enableStackTrace: z.boolean().default(false).describe("Include stack traces in error logs"),
      maxContextSize: z.number().default(1000).describe("Maximum size of context objects in characters"),
      transports: z.array(z.string()).default(["console"]).describe("Transport names to use"),
    })
    .strict()
    .openapi({
      ref: "LoggerConfig",
    })
  export type LoggerConfig = z.infer<typeof LoggerConfig>

  // Performance timer interface
  export interface PerformanceTimer {
    stop(): void
    [Symbol.dispose](): void
  }

  // Logger instance interface
  export interface LoggerInstance {
    debug(message: string, context?: Record<string, any>): void
    info(message: string, context?: Record<string, any>): void
    warn(message: string, context?: Record<string, any>): void
    error(message: string, error?: Error, context?: Record<string, any>): void
    fatal(message: string, error?: Error, context?: Record<string, any>): void

    // Context management
    child(context: Record<string, any>): LoggerInstance
    withContext(context: Record<string, any>): LoggerInstance

    // Performance tracking
    time(message: string, context?: Record<string, any>): PerformanceTimer

    // Utility methods
    setLevel(level: Level): void
    getLevel(): Level
    isLevelEnabled(level: Level): boolean

    // Metrics integration
    getMetrics(): Metrics.MetricsSnapshot
  }

  // Global logger registry
  const loggers = new Map<string, LoggerInstance>()
  let defaultConfig: LoggerConfig = {
    level: "info",
    service: "kuuzuki",
    enablePerformanceTracking: true,
    enableStackTrace: false,
    maxContextSize: 1000,
    transports: ["console"],
  }

  // Initialize logging system
  export async function init(config?: Partial<LoggerConfig>): Promise<void> {
    if (config) {
      defaultConfig = { ...defaultConfig, ...config }
    }

    // Initialize transport system
    await Transport.init()

    // Create default logger
    const defaultLogger = create({ service: "kuuzuki" })
    loggers.set("default", defaultLogger)

    defaultLogger.info("Logging system initialized", {
      level: defaultConfig.level,
      transports: defaultConfig.transports,
      performanceTracking: defaultConfig.enablePerformanceTracking,
    })
  }

  // Create a new logger instance
  export function create(config: Partial<LoggerConfig> & { service: string }): LoggerInstance {
    const loggerConfig = { ...defaultConfig, ...config }
    const metrics = new Metrics.MetricsCollector(config.service)

    // Check if logger already exists
    const existing = loggers.get(config.service)
    if (existing) {
      return existing
    }

    function shouldLog(level: Level): boolean {
      return levelPriority[level] >= levelPriority[loggerConfig.level]
    }

    function formatContext(context?: Record<string, any>): Record<string, any> | undefined {
      if (!context) return undefined

      const formatted = { ...loggerConfig.context, ...context }
      const serialized = JSON.stringify(formatted)

      if (serialized.length > loggerConfig.maxContextSize) {
        return {
          ...formatted,
          _truncated: true,
          _originalSize: serialized.length,
        }
      }

      return formatted
    }

    function createLogEntry(
      level: Level,
      message: string,
      context?: Record<string, any>,
      error?: Error,
      performance?: { duration: number; memory?: number; cpu?: number },
    ): LogEntry {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        service: loggerConfig.service,
        context: formatContext(context),
      }

      if (error) {
        entry.error = {
          name: error.name,
          message: error.message,
          stack: loggerConfig.enableStackTrace ? error.stack : undefined,
          code: getErrorCode(error),
        }
      }

      if (performance) {
        entry.performance = performance
      }

      // Add trace and session IDs if available from process env or other sources
      entry.traceId = process.env["TRACE_ID"]
      entry.sessionId = process.env["SESSION_ID"]

      return entry
    }

    async function writeLog(entry: LogEntry): Promise<void> {
      // Update metrics
      metrics.recordLog(entry.level)
      if (entry.performance) {
        metrics.recordPerformance(entry.message, entry.performance.duration)
      }

      // Write to all configured transports
      const transports = Transport.getTransports(loggerConfig.transports)
      await Promise.all(transports.map((transport: any) => transport.write(entry)))
    }

    const logger: LoggerInstance = {
      debug(message: string, context?: Record<string, any>): void {
        if (!shouldLog("debug")) return
        const entry = createLogEntry("debug", message, context)
        writeLog(entry).catch((err: any) => console.error("Failed to write log:", err))
      },

      info(message: string, context?: Record<string, any>): void {
        if (!shouldLog("info")) return
        const entry = createLogEntry("info", message, context)
        writeLog(entry).catch((err: any) => console.error("Failed to write log:", err))
      },

      warn(message: string, context?: Record<string, any>): void {
        if (!shouldLog("warn")) return
        const entry = createLogEntry("warn", message, context)
        writeLog(entry).catch((err: any) => console.error("Failed to write log:", err))
      },

      error(message: string, error?: Error, context?: Record<string, any>): void {
        if (!shouldLog("error")) return
        const entry = createLogEntry("error", message, context, error)
        writeLog(entry).catch((err: any) => console.error("Failed to write log:", err))
      },

      fatal(message: string, error?: Error, context?: Record<string, any>): void {
        if (!shouldLog("fatal")) return
        const entry = createLogEntry("fatal", message, context, error)
        writeLog(entry).catch((err: any) => console.error("Failed to write log:", err))
      },

      child(context: Record<string, any>): LoggerInstance {
        return create({
          ...loggerConfig,
          context: { ...loggerConfig.context, ...context },
        })
      },

      withContext(context: Record<string, any>): LoggerInstance {
        return this.child(context)
      },

      time(message: string, context?: Record<string, any>): PerformanceTimer {
        const startTime = Date.now()
        const startMemory = loggerConfig.enablePerformanceTracking ? process.memoryUsage().heapUsed : undefined

        logger.debug(`${message} - started`, context)

        function stop(): void {
          const duration = Date.now() - startTime
          const endMemory = loggerConfig.enablePerformanceTracking ? process.memoryUsage().heapUsed : undefined

          const performance = {
            duration,
            memory: endMemory && startMemory ? endMemory - startMemory : undefined,
          }

          const entry = createLogEntry("info", `${message} - completed`, context, undefined, performance)
          writeLog(entry).catch((err: any) => console.error("Failed to write log:", err))
        }

        return {
          stop,
          [Symbol.dispose]: stop,
        }
      },

      setLevel(level: Level): void {
        loggerConfig.level = level
      },

      getLevel(): Level {
        return loggerConfig.level
      },

      isLevelEnabled(level: Level): boolean {
        return shouldLog(level)
      },

      getMetrics(): Metrics.MetricsSnapshot {
        return metrics.getSnapshot()
      },
    }

    loggers.set(config.service, logger)
    return logger
  }

  // Get existing logger or create new one
  export function get(service: string): LoggerInstance {
    const existing = loggers.get(service)
    if (existing) {
      return existing
    }
    return create({ service })
  }

  // Get default logger
  export function getDefault(): LoggerInstance {
    return loggers.get("default") || create({ service: "kuuzuki" })
  }

  // List all active loggers
  export function listLoggers(): string[] {
    return Array.from(loggers.keys())
  }

  // Shutdown logging system
  export async function shutdown(): Promise<void> {
    const defaultLogger = loggers.get("default")
    if (defaultLogger) {
      defaultLogger.info("Shutting down logging system")
    }

    await Transport.shutdown()
    loggers.clear()
  }

  // Configuration management
  export function updateConfig(config: Partial<LoggerConfig>): void {
    defaultConfig = { ...defaultConfig, ...config }

    // Update all existing loggers
    for (const [, logger] of loggers) {
      if (config.level) {
        logger.setLevel(config.level)
      }
    }
  }

  export function getConfig(): LoggerConfig {
    return { ...defaultConfig }
  }

  // Utility functions for structured logging
  export namespace Utils {
    export function sanitizeContext(context: Record<string, any>): Record<string, any> {
      const sanitized: Record<string, any> = {}

      for (const [key, value] of Object.entries(context)) {
        if (
          typeof value === "string" &&
          (key.toLowerCase().includes("password") ||
            key.toLowerCase().includes("token") ||
            key.toLowerCase().includes("key"))
        ) {
          sanitized[key] = "[REDACTED]"
        } else if (typeof value === "object" && value !== null) {
          sanitized[key] = sanitizeContext(value)
        } else {
          sanitized[key] = value
        }
      }

      return sanitized
    }

    export function formatError(error: Error): Record<string, any> {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: getErrorCode(error),
        cause: (error as any).cause,
      }
    }

    export function createRequestContext(req: any): Record<string, any> {
      return {
        method: req.method,
        url: req.url,
        userAgent: req.headers?.["user-agent"],
        ip: req.headers?.["x-forwarded-for"] || req.connection?.remoteAddress,
        requestId: req.headers?.["x-request-id"],
      }
    }
  }
}
