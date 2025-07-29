import { z } from "zod"
import { extendZodWithOpenApi } from "zod-openapi"

extendZodWithOpenApi(z)

export namespace Metrics {
  // Metric types
  export const MetricType = z.enum(["counter", "gauge", "histogram", "timer"]).openapi({
    ref: "MetricType",
    description: "Type of metric being recorded",
  })
  export type MetricType = z.infer<typeof MetricType>

  // Performance metric entry
  export const PerformanceMetric = z
    .object({
      name: z.string().describe("Metric name"),
      type: MetricType.describe("Metric type"),
      value: z.number().describe("Metric value"),
      timestamp: z.number().describe("Unix timestamp when metric was recorded"),
      labels: z.record(z.string(), z.string()).optional().describe("Metric labels for categorization"),
      unit: z.string().optional().describe("Unit of measurement"),
    })
    .strict()
    .openapi({ ref: "PerformanceMetric" })
  export type PerformanceMetric = z.infer<typeof PerformanceMetric>

  // System resource metrics
  export const SystemMetrics = z
    .object({
      timestamp: z.number().describe("Unix timestamp"),
      memory: z
        .object({
          heapUsed: z.number().describe("Heap memory used in bytes"),
          heapTotal: z.number().describe("Total heap memory in bytes"),
          external: z.number().describe("External memory in bytes"),
          rss: z.number().describe("Resident set size in bytes"),
        })
        .describe("Memory usage metrics"),
      cpu: z
        .object({
          user: z.number().describe("User CPU time in microseconds"),
          system: z.number().describe("System CPU time in microseconds"),
          percent: z.number().optional().describe("CPU usage percentage"),
        })
        .describe("CPU usage metrics"),
      eventLoop: z
        .object({
          lag: z.number().describe("Event loop lag in milliseconds"),
        })
        .optional()
        .describe("Event loop metrics"),
    })
    .strict()
    .openapi({ ref: "SystemMetrics" })
  export type SystemMetrics = z.infer<typeof SystemMetrics>

  // Request/response metrics
  export const RequestMetrics = z
    .object({
      method: z.string().describe("HTTP method"),
      path: z.string().describe("Request path"),
      statusCode: z.number().describe("Response status code"),
      duration: z.number().describe("Request duration in milliseconds"),
      timestamp: z.number().describe("Unix timestamp"),
      userAgent: z.string().optional().describe("User agent string"),
      ip: z.string().optional().describe("Client IP address"),
      size: z
        .object({
          request: z.number().optional().describe("Request size in bytes"),
          response: z.number().optional().describe("Response size in bytes"),
        })
        .optional()
        .describe("Request/response sizes"),
    })
    .strict()
    .openapi({ ref: "RequestMetrics" })
  export type RequestMetrics = z.infer<typeof RequestMetrics>

  // Log metrics
  export const LogMetrics = z
    .object({
      level: z.enum(["debug", "info", "warn", "error", "fatal"]).describe("Log level"),
      count: z.number().describe("Number of log entries"),
      timestamp: z.number().describe("Unix timestamp"),
      service: z.string().describe("Service name"),
    })
    .strict()
    .openapi({ ref: "LogMetrics" })
  export type LogMetrics = z.infer<typeof LogMetrics>

  // Metrics snapshot for reporting
  export const MetricsSnapshot = z
    .object({
      timestamp: z.number().describe("Snapshot timestamp"),
      service: z.string().describe("Service name"),
      uptime: z.number().describe("Service uptime in milliseconds"),
      system: SystemMetrics.describe("System resource metrics"),
      performance: z.array(PerformanceMetric).describe("Performance metrics"),
      requests: z.array(RequestMetrics).describe("Request metrics"),
      logs: z.array(LogMetrics).describe("Log metrics"),
      custom: z.record(z.string(), z.any()).optional().describe("Custom metrics"),
    })
    .strict()
    .openapi({ ref: "MetricsSnapshot" })
  export type MetricsSnapshot = z.infer<typeof MetricsSnapshot>

  // Metrics collector class
  export class MetricsCollector {
    private startTime: number
    private performanceMetrics: PerformanceMetric[] = []
    private requestMetrics: RequestMetrics[] = []
    private logMetrics: Map<string, { count: number; timestamp: number }> = new Map()
    private customMetrics: Record<string, any> = {}
    private maxMetricsHistory = 1000

    constructor(private service: string) {
      this.startTime = Date.now()
    }

    // Record performance metric
    recordPerformance(name: string, duration: number, labels?: Record<string, string>): void {
      const metric: PerformanceMetric = {
        name,
        type: "timer",
        value: duration,
        timestamp: Date.now(),
        labels,
        unit: "ms",
      }

      this.performanceMetrics.push(metric)
      this.trimMetrics(this.performanceMetrics)
    }

    // Record counter metric
    recordCounter(name: string, value = 1, labels?: Record<string, string>): void {
      const metric: PerformanceMetric = {
        name,
        type: "counter",
        value,
        timestamp: Date.now(),
        labels,
      }

      this.performanceMetrics.push(metric)
      this.trimMetrics(this.performanceMetrics)
    }

    // Record gauge metric
    recordGauge(name: string, value: number, labels?: Record<string, string>, unit?: string): void {
      const metric: PerformanceMetric = {
        name,
        type: "gauge",
        value,
        timestamp: Date.now(),
        labels,
        unit,
      }

      this.performanceMetrics.push(metric)
      this.trimMetrics(this.performanceMetrics)
    }

    // Record histogram metric
    recordHistogram(name: string, value: number, labels?: Record<string, string>, unit?: string): void {
      const metric: PerformanceMetric = {
        name,
        type: "histogram",
        value,
        timestamp: Date.now(),
        labels,
        unit,
      }

      this.performanceMetrics.push(metric)
      this.trimMetrics(this.performanceMetrics)
    }

    // Record request metric
    recordRequest(metrics: Omit<RequestMetrics, "timestamp">): void {
      const requestMetric: RequestMetrics = {
        ...metrics,
        timestamp: Date.now(),
      }

      this.requestMetrics.push(requestMetric)
      this.trimMetrics(this.requestMetrics)
    }

    // Record log metric
    recordLog(level: "debug" | "info" | "warn" | "error" | "fatal"): void {
      const key = `${this.service}:${level}`
      const existing = this.logMetrics.get(key)

      if (existing) {
        existing.count++
        existing.timestamp = Date.now()
      } else {
        this.logMetrics.set(key, {
          count: 1,
          timestamp: Date.now(),
        })
      }
    }

    // Record custom metric
    recordCustom(name: string, value: any): void {
      this.customMetrics[name] = value
    }

    // Get system metrics
    private getSystemMetrics(): SystemMetrics {
      const memUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()

      return {
        timestamp: Date.now(),
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
      }
    }

    // Get metrics snapshot
    getSnapshot(): MetricsSnapshot {
      const logMetricsArray: LogMetrics[] = Array.from(this.logMetrics.entries()).map(([key, data]) => {
        const [service, level] = key.split(":")
        return {
          level: level as "debug" | "info" | "warn" | "error" | "fatal",
          count: data.count,
          timestamp: data.timestamp,
          service,
        }
      })

      return {
        timestamp: Date.now(),
        service: this.service,
        uptime: Date.now() - this.startTime,
        system: this.getSystemMetrics(),
        performance: [...this.performanceMetrics],
        requests: [...this.requestMetrics],
        logs: logMetricsArray,
        custom: { ...this.customMetrics },
      }
    }

    // Clear all metrics
    clear(): void {
      this.performanceMetrics = []
      this.requestMetrics = []
      this.logMetrics.clear()
      this.customMetrics = {}
    }

    // Trim metrics arrays to prevent memory leaks
    private trimMetrics<T>(metrics: T[]): void {
      if (metrics.length > this.maxMetricsHistory) {
        metrics.splice(0, metrics.length - this.maxMetricsHistory)
      }
    }

    // Set maximum metrics history
    setMaxHistory(max: number): void {
      this.maxMetricsHistory = max
    }
  }

  // Global metrics registry
  const collectors = new Map<string, MetricsCollector>()

  // Get or create metrics collector
  export function getCollector(service: string): MetricsCollector {
    let collector = collectors.get(service)
    if (!collector) {
      collector = new MetricsCollector(service)
      collectors.set(service, collector)
    }
    return collector
  }

  // Get all collectors
  export function getAllCollectors(): Map<string, MetricsCollector> {
    return new Map(collectors)
  }

  // Get aggregated metrics snapshot
  export function getAggregatedSnapshot(): Record<string, MetricsSnapshot> {
    const snapshots: Record<string, MetricsSnapshot> = {}

    for (const [service, collector] of collectors) {
      snapshots[service] = collector.getSnapshot()
    }

    return snapshots
  }

  // Performance tracking utilities
  export namespace Performance {
    // Track function execution time
    export function trackFunction<T extends (...args: any[]) => any>(
      fn: T,
      name: string,
      service: string,
      labels?: Record<string, string>,
    ): T {
      return ((...args: any[]) => {
        const start = Date.now()
        const collector = getCollector(service)

        try {
          const result = fn(...args)

          // Handle async functions
          if (result && typeof result.then === "function") {
            return result
              .then((value: any) => {
                collector.recordPerformance(name, Date.now() - start, labels)
                return value
              })
              .catch((error: any) => {
                collector.recordPerformance(name, Date.now() - start, { ...labels, error: "true" })
                throw error
              })
          }

          // Handle sync functions
          collector.recordPerformance(name, Date.now() - start, labels)
          return result
        } catch (error) {
          collector.recordPerformance(name, Date.now() - start, { ...labels, error: "true" })
          throw error
        }
      }) as T
    }

    // Create performance timer
    export function createTimer(name: string, service: string, labels?: Record<string, string>) {
      const start = Date.now()
      const collector = getCollector(service)

      return {
        stop(): number {
          const duration = Date.now() - start
          collector.recordPerformance(name, duration, labels)
          return duration
        },
        [Symbol.dispose](): void {
          const duration = Date.now() - start
          collector.recordPerformance(name, duration, labels)
        },
      }
    }

    // Track memory usage
    export function trackMemory(service: string, name: string): void {
      const collector = getCollector(service)
      const memUsage = process.memoryUsage()

      collector.recordGauge(`${name}.heap_used`, memUsage.heapUsed, undefined, "bytes")
      collector.recordGauge(`${name}.heap_total`, memUsage.heapTotal, undefined, "bytes")
      collector.recordGauge(`${name}.external`, memUsage.external, undefined, "bytes")
      collector.recordGauge(`${name}.rss`, memUsage.rss, undefined, "bytes")
    }

    // Track event loop lag
    export function trackEventLoopLag(service: string): void {
      const collector = getCollector(service)
      const start = process.hrtime.bigint()

      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000 // Convert to milliseconds
        collector.recordGauge("event_loop_lag", lag, undefined, "ms")
      })
    }
  }

  // Request tracking utilities
  export namespace Request {
    // Track HTTP request
    export function trackRequest(
      method: string,
      path: string,
      statusCode: number,
      duration: number,
      service: string,
      options?: {
        userAgent?: string
        ip?: string
        requestSize?: number
        responseSize?: number
      },
    ): void {
      const collector = getCollector(service)

      collector.recordRequest({
        method,
        path,
        statusCode,
        duration,
        userAgent: options?.userAgent,
        ip: options?.ip,
        size: {
          request: options?.requestSize,
          response: options?.responseSize,
        },
      })
    }

    // Create request middleware for tracking
    export function createMiddleware(service: string) {
      return (req: any, res: any, next: any) => {
        const start = Date.now()
        const originalSend = res.send
        let responseSize = 0

        res.send = function (data: any) {
          if (data) {
            responseSize = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data.toString())
          }
          return originalSend.call(this, data)
        }

        res.on("finish", () => {
          const duration = Date.now() - start
          const requestSize = parseInt(req.headers["content-length"] || "0", 10)

          trackRequest(req.method, req.path || req.url, res.statusCode, duration, service, {
            userAgent: req.headers["user-agent"],
            ip: req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
            requestSize: requestSize || undefined,
            responseSize: responseSize || undefined,
          })
        })

        next()
      }
    }
  }

  // Cleanup utilities
  export function cleanup(): void {
    collectors.clear()
  }

  export function cleanupCollector(service: string): void {
    collectors.delete(service)
  }
}
