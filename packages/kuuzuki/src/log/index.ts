// Main logging system exports
export { Logger } from "./logger"
export { Transport } from "./transport"
export { Metrics } from "./metrics"

// Convenience exports for quick access
export const {
  init: initLogger,
  create: createLogger,
  get: getLogger,
  getDefault: getDefaultLogger,
  shutdown: shutdownLogger,
  updateConfig: updateLoggerConfig,
  getConfig: getLoggerConfig,
  Utils: LoggerUtils,
} = Logger

export const {
  init: initTransport,
  getTransports,
  getTransport,
  addTransport,
  removeTransport,
  listTransports,
  flushAll: flushAllTransports,
  shutdown: shutdownTransport,
  Rotation: LogRotation,
} = Transport

export const {
  getCollector: getMetricsCollector,
  getAllCollectors: getAllMetricsCollectors,
  getAggregatedSnapshot: getAggregatedMetricsSnapshot,
  Performance: PerformanceMetrics,
  Request: RequestMetrics,
  cleanup: cleanupMetrics,
  cleanupCollector: cleanupMetricsCollector,
} = Metrics

// Default logger instance for immediate use
let defaultLogger: Logger.LoggerInstance | null = null

// Initialize and get default logger
export async function getDefaultLoggerInstance(): Promise<Logger.LoggerInstance> {
  if (!defaultLogger) {
    await Logger.init()
    defaultLogger = Logger.getDefault()
  }
  return defaultLogger
}

// Quick logging functions using default logger
export async function debug(message: string, context?: Record<string, any>): Promise<void> {
  const logger = await getDefaultLoggerInstance()
  logger.debug(message, context)
}

export async function info(message: string, context?: Record<string, any>): Promise<void> {
  const logger = await getDefaultLoggerInstance()
  logger.info(message, context)
}

export async function warn(message: string, context?: Record<string, any>): Promise<void> {
  const logger = await getDefaultLoggerInstance()
  logger.warn(message, context)
}

export async function error(message: string, err?: Error, context?: Record<string, any>): Promise<void> {
  const logger = await getDefaultLoggerInstance()
  logger.error(message, err, context)
}

export async function fatal(message: string, err?: Error, context?: Record<string, any>): Promise<void> {
  const logger = await getDefaultLoggerInstance()
  logger.fatal(message, err, context)
}

// Performance timing helper
export async function time(message: string, context?: Record<string, any>): Promise<Logger.PerformanceTimer> {
  const logger = await getDefaultLoggerInstance()
  return logger.time(message, context)
}
