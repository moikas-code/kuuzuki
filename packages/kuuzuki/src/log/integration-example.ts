// Example integration of the new logging system with existing kuuzuki components
import { Logger, Transport, Metrics } from "./index"
import { Config } from "../config/config"

// Example: Server integration
export namespace ServerLogging {
  let serverLogger: Logger.LoggerInstance

  export async function initializeServerLogging(): Promise<void> {
    // Initialize logging system with configuration
    await Logger.init({
      level: "info",
      service: "kuuzuki-server",
      enablePerformanceTracking: true,
      enableStackTrace: process.env.NODE_ENV === "development",
      transports: ["console", "file"],
    })

    // Initialize transports with custom configuration
    await Transport.init({
      console: {
        type: "console",
        level: "info",
        colorize: true,
        timestamp: true,
        format: "pretty",
      },
      file: {
        type: "file",
        level: "debug",
        filename: "/tmp/kuuzuki-server.log",
        maxSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        compress: true,
        format: "json",
      },
    })

    serverLogger = Logger.get("kuuzuki-server")
    serverLogger.info("Server logging initialized")
  }

  export function getServerLogger(): Logger.LoggerInstance {
    return serverLogger
  }

  // Request logging middleware
  export function createRequestLoggingMiddleware() {
    return async (c: any, next: any) => {
      const start = Date.now()
      const requestId = c.req.header("x-request-id") || Math.random().toString(36).substring(7)

      // Create request-specific logger with context
      const requestLogger = serverLogger.child({
        requestId,
        method: c.req.method,
        path: c.req.path,
        userAgent: c.req.header("user-agent"),
        ip: c.req.header("x-forwarded-for") || "unknown",
      })

      // Log request start
      requestLogger.info("Request started")

      // Add logger to context
      c.set("logger", requestLogger)

      try {
        await next()

        // Log successful request
        const duration = Date.now() - start
        requestLogger.info("Request completed", {
          statusCode: c.res.status,
          duration,
        })

        // Record metrics
        const metrics = Metrics.getCollector("kuuzuki-server")
        metrics.recordRequest({
          method: c.req.method,
          path: c.req.path,
          statusCode: c.res.status,
          duration,
          userAgent: c.req.header("user-agent"),
          ip: c.req.header("x-forwarded-for"),
        })
      } catch (error) {
        // Log error
        const duration = Date.now() - start
        requestLogger.error("Request failed", error as Error, {
          duration,
        })
        throw error
      }
    }
  }
}

// Example: Session integration
export namespace SessionLogging {
  export function createSessionLogger(sessionId: string): Logger.LoggerInstance {
    return Logger.get("kuuzuki-session").child({
      sessionId,
      component: "session",
    })
  }

  export function logSessionEvent(sessionId: string, event: string, data?: Record<string, any>): void {
    const logger = createSessionLogger(sessionId)
    logger.info(`Session ${event}`, data)
  }

  export function logSessionError(sessionId: string, error: Error, context?: Record<string, any>): void {
    const logger = createSessionLogger(sessionId)
    logger.error("Session error", error, context)
  }
}

// Example: Tool execution logging
export namespace ToolLogging {
  export function createToolLogger(toolName: string): Logger.LoggerInstance {
    return Logger.get("kuuzuki-tools").child({
      tool: toolName,
      component: "tool",
    })
  }

  export async function logToolExecution<T>(toolName: string, args: any, executor: () => Promise<T>): Promise<T> {
    const logger = createToolLogger(toolName)
    const timer = logger.time(`Tool ${toolName} execution`, { args })

    try {
      logger.debug("Tool execution started", { args })
      const result = await executor()
      logger.info("Tool execution completed successfully")
      return result
    } catch (error) {
      logger.error("Tool execution failed", error as Error, { args })
      throw error
    } finally {
      timer.stop()
    }
  }
}

// Example: Provider integration
export namespace ProviderLogging {
  export function createProviderLogger(providerId: string): Logger.LoggerInstance {
    return Logger.get("kuuzuki-provider").child({
      provider: providerId,
      component: "provider",
    })
  }

  export function logProviderRequest(providerId: string, model: string, request: any): void {
    const logger = createProviderLogger(providerId)
    logger.info("Provider request", {
      model,
      requestSize: JSON.stringify(request).length,
    })
  }

  export function logProviderResponse(providerId: string, model: string, response: any, duration: number): void {
    const logger = createProviderLogger(providerId)
    logger.info("Provider response", {
      model,
      responseSize: JSON.stringify(response).length,
      duration,
    })
  }

  export function logProviderError(providerId: string, model: string, error: Error, duration: number): void {
    const logger = createProviderLogger(providerId)
    logger.error("Provider error", error, {
      model,
      duration,
    })
  }
}

// Example: Configuration integration
export namespace ConfigLogging {
  export async function initializeFromConfig(): Promise<void> {
    const config = await Config.get()

    // Extract logging configuration from main config
    const loggingConfig = {
      level: (process.env["LOG_LEVEL"] as Logger.Level) || "info",
      enablePerformanceTracking: config.experimental?.performance?.requestBatching !== false,
      enableStackTrace: process.env.NODE_ENV === "development",
      transports: ["console", "file"] as string[],
    }

    // Add remote transport if configured
    if (process.env["LOG_REMOTE_URL"]) {
      await Transport.addTransport("remote", {
        type: "remote",
        level: "warn",
        url: process.env["LOG_REMOTE_URL"]!,
        batchSize: 50,
        flushInterval: 10000,
        timeout: 5000,
        retries: 3,
        format: "json",
      })
      loggingConfig.transports.push("remote")
    }

    await Logger.init(loggingConfig)
  }
}

// Example: Metrics dashboard integration
export namespace MetricsDashboard {
  export function getSystemMetrics(): Record<string, any> {
    const allMetrics = Metrics.getAggregatedSnapshot()

    return {
      timestamp: Date.now(),
      services: Object.keys(allMetrics),
      summary: Object.entries(allMetrics).reduce(
        (acc, [service, metrics]) => {
          acc[service] = {
            uptime: metrics.uptime,
            logCounts: metrics.logs.reduce(
              (counts, log) => {
                counts[log.level] = (counts[log.level] || 0) + log.count
                return counts
              },
              {} as Record<string, number>,
            ),
            requestCount: metrics.requests.length,
            avgResponseTime:
              metrics.requests.length > 0
                ? metrics.requests.reduce((sum, req) => sum + req.duration, 0) / metrics.requests.length
                : 0,
            memoryUsage: metrics.system.memory,
            cpuUsage: metrics.system.cpu,
          }
          return acc
        },
        {} as Record<string, any>,
      ),
    }
  }

  export async function exportMetrics(format: "json" | "prometheus" = "json"): Promise<string> {
    const metrics = getSystemMetrics()

    if (format === "json") {
      return JSON.stringify(metrics, null, 2)
    }

    // Basic Prometheus format export
    let output = ""
    for (const [service, data] of Object.entries(metrics["summary"])) {
      const serviceData = data as any
      output += `# HELP kuuzuki_uptime_seconds Service uptime in seconds\n`
      output += `# TYPE kuuzuki_uptime_seconds counter\n`
      output += `kuuzuki_uptime_seconds{service="${service}"} ${serviceData.uptime / 1000}\n\n`

      output += `# HELP kuuzuki_requests_total Total number of requests\n`
      output += `# TYPE kuuzuki_requests_total counter\n`
      output += `kuuzuki_requests_total{service="${service}"} ${serviceData.requestCount}\n\n`

      output += `# HELP kuuzuki_response_time_avg Average response time in milliseconds\n`
      output += `# TYPE kuuzuki_response_time_avg gauge\n`
      output += `kuuzuki_response_time_avg{service="${service}"} ${serviceData.avgResponseTime}\n\n`
    }

    return output
  }
}

// Example: Cleanup and shutdown
export namespace LoggingCleanup {
  export async function gracefulShutdown(): Promise<void> {
    const logger = Logger.getDefault()
    logger.info("Starting graceful shutdown of logging system")

    try {
      // Flush all transports
      await Transport.flushAll()
      logger.info("All log transports flushed")

      // Cleanup metrics
      Metrics.cleanup()
      logger.info("Metrics cleaned up")

      // Shutdown logging system
      await Logger.shutdown()
      console.log("Logging system shutdown complete")
    } catch (error) {
      console.error("Error during logging system shutdown:", error)
    }
  }

  export async function rotateLogs(): Promise<void> {
    const logger = Logger.getDefault()
    logger.info("Starting log rotation")

    try {
      await Transport.Rotation.cleanupOldLogs("/tmp/logs", 7 * 24 * 60 * 60 * 1000) // 7 days
      logger.info("Log rotation completed")
    } catch (error) {
      logger.error("Log rotation failed", error)
    }
  }
}
