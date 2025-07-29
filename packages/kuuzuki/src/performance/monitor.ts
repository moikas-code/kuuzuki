import { z } from "zod"
import { Logger } from "../log/logger"
import { EventEmitter } from "events"

export namespace Monitor {
  const log = Logger.create({ service: "monitor" })

  // Monitor configuration schema
  export const MonitorConfig = z
    .object({
      performance: z
        .object({
          enabled: z.boolean().default(true),
          sampleInterval: z.number().default(1000), // ms
          metricsRetention: z.number().default(3600000), // 1 hour
          slowThreshold: z.number().default(1000), // ms
          enableProfiling: z.boolean().default(false),
        })
        .default({}),
      bottleneck: z
        .object({
          enabled: z.boolean().default(true),
          detectionThreshold: z.number().default(0.8), // 80% threshold
          analysisWindow: z.number().default(30000), // 30 seconds
          minSamples: z.number().default(10),
        })
        .default({}),
      resources: z
        .object({
          enabled: z.boolean().default(true),
          trackMemory: z.boolean().default(true),
          trackCPU: z.boolean().default(true),
          trackEventLoop: z.boolean().default(true),
          trackHandles: z.boolean().default(true),
        })
        .default({}),
      alerts: z
        .object({
          enabled: z.boolean().default(true),
          memoryThreshold: z.number().default(0.85), // 85% of heap
          cpuThreshold: z.number().default(0.8), // 80% CPU usage
          eventLoopThreshold: z.number().default(100), // ms
          responseTimeThreshold: z.number().default(5000), // 5 seconds
        })
        .default({}),
    })
    .default({})

  export type MonitorConfig = z.infer<typeof MonitorConfig>

  // Performance metrics interfaces
  export interface PerformanceMetric {
    timestamp: number
    name: string
    value: number
    unit: string
    tags?: Record<string, string>
  }

  export interface ResourceUsage {
    timestamp: number
    memory: {
      heapUsed: number
      heapTotal: number
      external: number
      rss: number
      heapUtilization: number
    }
    cpu: {
      usage: number
      user: number
      system: number
    }
    eventLoop: {
      delay: number
      utilization: number
    }
    handles: {
      active: number
      refs: number
    }
  }

  export interface BottleneckInfo {
    type: "memory" | "cpu" | "io" | "eventloop" | "custom"
    severity: "low" | "medium" | "high" | "critical"
    description: string
    metrics: Record<string, number>
    suggestions: string[]
    timestamp: number
    duration?: number
  }

  export interface PerformanceAlert {
    id: string
    type: "performance" | "resource" | "bottleneck" | "error"
    severity: "info" | "warning" | "error" | "critical"
    message: string
    details: Record<string, any>
    timestamp: number
    resolved?: boolean
    resolvedAt?: number
  }

  export interface MonitorStats {
    uptime: number
    totalRequests: number
    averageResponseTime: number
    errorRate: number
    throughput: number
    activeConnections: number
    resourceUsage: ResourceUsage
    recentBottlenecks: BottleneckInfo[]
    activeAlerts: PerformanceAlert[]
  }

  // Global state
  let config: MonitorConfig = MonitorConfig.parse({})
  let isInitialized = false
  let monitoringTimer: NodeJS.Timeout | null = null
  let eventEmitter = new EventEmitter()

  // Data storage
  const performanceMetrics: PerformanceMetric[] = []
  const resourceHistory: ResourceUsage[] = []
  const bottlenecks: BottleneckInfo[] = []
  const alerts: Map<string, PerformanceAlert> = new Map()

  // Performance tracking
  const requestTimes: number[] = []
  const operationTimes = new Map<string, number[]>()
  let totalRequests = 0
  let errorCount = 0
  let startTime = Date.now()

  // Performance monitoring
  export namespace Performance {
    export function recordMetric(
      name: string,
      value: number,
      unit: string = "ms",
      tags?: Record<string, string>,
    ): void {
      if (!config.performance.enabled) return

      const metric: PerformanceMetric = {
        timestamp: Date.now(),
        name,
        value,
        unit,
        tags,
      }

      performanceMetrics.push(metric)

      // Clean old metrics
      const cutoff = Date.now() - config.performance.metricsRetention
      while (performanceMetrics.length > 0 && performanceMetrics[0].timestamp < cutoff) {
        performanceMetrics.shift()
      }

      // Check for slow operations
      if (unit === "ms" && value > config.performance.slowThreshold) {
        log.warn("Slow operation detected", {
          operation: name,
          duration: value,
          threshold: config.performance.slowThreshold,
          tags,
        })

        emitAlert({
          id: `slow-${name}-${Date.now()}`,
          type: "performance",
          severity: value > config.performance.slowThreshold * 2 ? "error" : "warning",
          message: `Slow operation: ${name}`,
          details: { duration: value, threshold: config.performance.slowThreshold, tags },
          timestamp: Date.now(),
        })
      }

      log.debug("Performance metric recorded", { name, value, unit, tags })
    }

    export function recordRequestTime(duration: number): void {
      requestTimes.push(duration)
      totalRequests++

      // Keep only recent request times (last 1000 requests)
      if (requestTimes.length > 1000) {
        requestTimes.shift()
      }

      recordMetric("request_duration", duration, "ms")
    }

    export function recordOperationTime(operation: string, duration: number): void {
      if (!operationTimes.has(operation)) {
        operationTimes.set(operation, [])
      }

      const times = operationTimes.get(operation)!
      times.push(duration)

      // Keep only recent times
      if (times.length > 100) {
        times.shift()
      }

      recordMetric(`operation_${operation}`, duration, "ms", { operation })
    }

    export function recordError(error: Error, context?: Record<string, any>): void {
      errorCount++
      recordMetric("error_count", 1, "count", {
        error: error.name,
        ...context,
      })

      log.error("Performance error recorded", error, context)
    }

    export function getAverageResponseTime(): number {
      if (requestTimes.length === 0) return 0
      return requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length
    }

    export function getThroughput(): number {
      const uptime = (Date.now() - startTime) / 1000 // seconds
      return uptime > 0 ? totalRequests / uptime : 0
    }

    export function getErrorRate(): number {
      return totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
    }

    export function getMetrics(name?: string, since?: number): PerformanceMetric[] {
      let filtered = performanceMetrics

      if (name) {
        filtered = filtered.filter((m) => m.name === name)
      }

      if (since) {
        filtered = filtered.filter((m) => m.timestamp >= since)
      }

      return [...filtered]
    }

    export function getOperationStats(operation: string): {
      count: number
      average: number
      min: number
      max: number
      p95: number
    } {
      const times = operationTimes.get(operation) || []

      if (times.length === 0) {
        return { count: 0, average: 0, min: 0, max: 0, p95: 0 }
      }

      const sorted = [...times].sort((a, b) => a - b)
      const p95Index = Math.floor(sorted.length * 0.95)

      return {
        count: times.length,
        average: times.reduce((sum, time) => sum + time, 0) / times.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[p95Index] || sorted[sorted.length - 1],
      }
    }
  }

  // Bottleneck detection
  export namespace Bottleneck {
    export function detectBottlenecks(): BottleneckInfo[] {
      if (!config.bottleneck.enabled) return []

      const detected: BottleneckInfo[] = []
      const now = Date.now()

      // Memory bottleneck detection
      if (config.resources.trackMemory) {
        const memoryBottleneck = detectMemoryBottleneck()
        if (memoryBottleneck) detected.push(memoryBottleneck)
      }

      // CPU bottleneck detection
      if (config.resources.trackCPU) {
        const cpuBottleneck = detectCPUBottleneck()
        if (cpuBottleneck) detected.push(cpuBottleneck)
      }

      // Event loop bottleneck detection
      if (config.resources.trackEventLoop) {
        const eventLoopBottleneck = detectEventLoopBottleneck()
        if (eventLoopBottleneck) detected.push(eventLoopBottleneck)
      }

      // I/O bottleneck detection
      const ioBottleneck = detectIOBottleneck()
      if (ioBottleneck) detected.push(ioBottleneck)

      // Store detected bottlenecks
      detected.forEach((bottleneck) => {
        bottlenecks.push(bottleneck)
        log.warn("Bottleneck detected", bottleneck)

        emitAlert({
          id: `bottleneck-${bottleneck.type}-${now}`,
          type: "bottleneck",
          severity: bottleneck.severity === "critical" ? "critical" : "warning",
          message: `${bottleneck.type.toUpperCase()} bottleneck: ${bottleneck.description}`,
          details: bottleneck,
          timestamp: now,
        })
      })

      // Clean old bottlenecks
      const cutoff = now - config.bottleneck.analysisWindow * 10 // Keep 10x analysis window
      while (bottlenecks.length > 0 && bottlenecks[0].timestamp < cutoff) {
        bottlenecks.shift()
      }

      return detected
    }

    function detectMemoryBottleneck(): BottleneckInfo | null {
      const recent = getRecentResourceUsage(config.bottleneck.analysisWindow)
      if (recent.length < config.bottleneck.minSamples) return null

      const avgHeapUtilization = recent.reduce((sum, r) => sum + r.memory.heapUtilization, 0) / recent.length

      if (avgHeapUtilization > config.bottleneck.detectionThreshold) {
        return {
          type: "memory",
          severity: avgHeapUtilization > 0.95 ? "critical" : avgHeapUtilization > 0.9 ? "high" : "medium",
          description: `High memory utilization: ${(avgHeapUtilization * 100).toFixed(1)}%`,
          metrics: {
            heapUtilization: avgHeapUtilization,
            heapUsed: recent[recent.length - 1].memory.heapUsed,
            heapTotal: recent[recent.length - 1].memory.heapTotal,
          },
          suggestions: [
            "Consider increasing heap size",
            "Review memory leaks",
            "Implement object pooling",
            "Optimize data structures",
          ],
          timestamp: Date.now(),
        }
      }

      return null
    }

    function detectCPUBottleneck(): BottleneckInfo | null {
      const recent = getRecentResourceUsage(config.bottleneck.analysisWindow)
      if (recent.length < config.bottleneck.minSamples) return null

      const avgCPUUsage = recent.reduce((sum, r) => sum + r.cpu.usage, 0) / recent.length

      if (avgCPUUsage > config.bottleneck.detectionThreshold) {
        return {
          type: "cpu",
          severity: avgCPUUsage > 0.95 ? "critical" : avgCPUUsage > 0.9 ? "high" : "medium",
          description: `High CPU utilization: ${(avgCPUUsage * 100).toFixed(1)}%`,
          metrics: {
            cpuUsage: avgCPUUsage,
            userTime: recent[recent.length - 1].cpu.user,
            systemTime: recent[recent.length - 1].cpu.system,
          },
          suggestions: [
            "Optimize CPU-intensive operations",
            "Consider worker threads",
            "Review algorithmic complexity",
            "Implement caching",
          ],
          timestamp: Date.now(),
        }
      }

      return null
    }

    function detectEventLoopBottleneck(): BottleneckInfo | null {
      const recent = getRecentResourceUsage(config.bottleneck.analysisWindow)
      if (recent.length < config.bottleneck.minSamples) return null

      const avgEventLoopDelay = recent.reduce((sum, r) => sum + r.eventLoop.delay, 0) / recent.length

      if (avgEventLoopDelay > config.alerts.eventLoopThreshold) {
        return {
          type: "eventloop",
          severity: avgEventLoopDelay > 500 ? "critical" : avgEventLoopDelay > 200 ? "high" : "medium",
          description: `High event loop delay: ${avgEventLoopDelay.toFixed(1)}ms`,
          metrics: {
            eventLoopDelay: avgEventLoopDelay,
            eventLoopUtilization: recent[recent.length - 1].eventLoop.utilization,
          },
          suggestions: [
            "Reduce synchronous operations",
            "Use setImmediate for heavy tasks",
            "Consider clustering",
            "Profile blocking operations",
          ],
          timestamp: Date.now(),
        }
      }

      return null
    }

    function detectIOBottleneck(): BottleneckInfo | null {
      // Detect I/O bottlenecks based on response times and operation patterns
      const recentMetrics = Performance.getMetrics(undefined, Date.now() - config.bottleneck.analysisWindow)
      const ioMetrics = recentMetrics.filter(
        (m) =>
          m.name.includes("io") || m.name.includes("file") || m.name.includes("network") || m.name.includes("database"),
      )

      if (ioMetrics.length < config.bottleneck.minSamples) return null

      const avgIOTime = ioMetrics.reduce((sum, m) => sum + m.value, 0) / ioMetrics.length
      const slowIOOperations = ioMetrics.filter((m) => m.value > config.performance.slowThreshold).length
      const ioBottleneckRatio = slowIOOperations / ioMetrics.length

      if (ioBottleneckRatio > config.bottleneck.detectionThreshold * 0.5) {
        // Lower threshold for I/O
        return {
          type: "io",
          severity: ioBottleneckRatio > 0.8 ? "critical" : ioBottleneckRatio > 0.6 ? "high" : "medium",
          description: `High I/O latency: ${avgIOTime.toFixed(1)}ms average, ${(ioBottleneckRatio * 100).toFixed(1)}% slow operations`,
          metrics: {
            averageIOTime: avgIOTime,
            slowOperationRatio: ioBottleneckRatio,
            totalIOOperations: ioMetrics.length,
          },
          suggestions: [
            "Optimize database queries",
            "Implement connection pooling",
            "Use async I/O operations",
            "Consider caching frequently accessed data",
          ],
          timestamp: Date.now(),
        }
      }

      return null
    }

    export function getBottlenecks(since?: number): BottleneckInfo[] {
      let filtered = bottlenecks

      if (since) {
        filtered = filtered.filter((b) => b.timestamp >= since)
      }

      return [...filtered]
    }
  }

  // Resource usage tracking
  export namespace Resources {
    let lastCPUUsage = process.cpuUsage()
    let lastCPUTime = Date.now()

    export function getCurrentUsage(): ResourceUsage {
      const memUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage(lastCPUUsage)
      const currentTime = Date.now()
      const timeDiff = currentTime - lastCPUTime

      // Calculate CPU usage percentage
      const totalCPUTime = (cpuUsage.user + cpuUsage.system) / 1000 // Convert to ms
      const cpuPercent = timeDiff > 0 ? Math.min(totalCPUTime / timeDiff, 1) : 0

      // Update for next calculation
      lastCPUUsage = process.cpuUsage()
      lastCPUTime = currentTime

      // Event loop metrics (simplified)
      const eventLoopDelay = measureEventLoopDelay()
      const eventLoopUtilization = measureEventLoopUtilization()

      return {
        timestamp: currentTime,
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss,
          heapUtilization: memUsage.heapUsed / memUsage.heapTotal,
        },
        cpu: {
          usage: cpuPercent,
          user: cpuUsage.user / 1000,
          system: cpuUsage.system / 1000,
        },
        eventLoop: {
          delay: eventLoopDelay,
          utilization: eventLoopUtilization,
        },
        handles: {
          active: (process as any)._getActiveHandles?.()?.length || 0,
          refs: (process as any)._getActiveRequests?.()?.length || 0,
        },
      }
    }

    function measureEventLoopDelay(): number {
      // Simplified event loop delay measurement
      const start = Date.now()
      setImmediate(() => {
        const delay = Date.now() - start
        Performance.recordMetric("event_loop_delay", delay, "ms")
      })
      return 0 // Return 0 for now, actual measurement happens async
    }

    function measureEventLoopUtilization(): number {
      // Simplified utilization measurement
      // In a real implementation, you'd use perf_hooks.performance
      return 0.5 // Placeholder
    }

    export function trackResources(): void {
      if (!config.resources.enabled) return

      const usage = getCurrentUsage()
      resourceHistory.push(usage)

      // Clean old history
      const cutoff = Date.now() - config.performance.metricsRetention
      while (resourceHistory.length > 0 && resourceHistory[0].timestamp < cutoff) {
        resourceHistory.shift()
      }

      // Record metrics
      Performance.recordMetric("memory_heap_used", usage.memory.heapUsed, "bytes")
      Performance.recordMetric("memory_heap_utilization", usage.memory.heapUtilization * 100, "percent")
      Performance.recordMetric("cpu_usage", usage.cpu.usage * 100, "percent")
      Performance.recordMetric("event_loop_delay", usage.eventLoop.delay, "ms")

      // Check for alerts
      checkResourceAlerts(usage)
    }

    function checkResourceAlerts(usage: ResourceUsage): void {
      if (!config.alerts.enabled) return

      // Memory alert
      if (usage.memory.heapUtilization > config.alerts.memoryThreshold) {
        emitAlert({
          id: `memory-${Date.now()}`,
          type: "resource",
          severity: usage.memory.heapUtilization > 0.95 ? "critical" : "warning",
          message: `High memory usage: ${(usage.memory.heapUtilization * 100).toFixed(1)}%`,
          details: { memoryUsage: usage.memory },
          timestamp: Date.now(),
        })
      }

      // CPU alert
      if (usage.cpu.usage > config.alerts.cpuThreshold) {
        emitAlert({
          id: `cpu-${Date.now()}`,
          type: "resource",
          severity: usage.cpu.usage > 0.95 ? "critical" : "warning",
          message: `High CPU usage: ${(usage.cpu.usage * 100).toFixed(1)}%`,
          details: { cpuUsage: usage.cpu },
          timestamp: Date.now(),
        })
      }

      // Event loop alert
      if (usage.eventLoop.delay > config.alerts.eventLoopThreshold) {
        emitAlert({
          id: `eventloop-${Date.now()}`,
          type: "resource",
          severity: usage.eventLoop.delay > 500 ? "critical" : "warning",
          message: `High event loop delay: ${usage.eventLoop.delay.toFixed(1)}ms`,
          details: { eventLoop: usage.eventLoop },
          timestamp: Date.now(),
        })
      }
    }

    export function getResourceHistory(since?: number): ResourceUsage[] {
      let filtered = resourceHistory

      if (since) {
        filtered = filtered.filter((r) => r.timestamp >= since)
      }

      return [...filtered]
    }
  }

  // Alert management
  export namespace Alerts {
    export function getAlerts(resolved?: boolean): PerformanceAlert[] {
      const alertList = Array.from(alerts.values())

      if (resolved !== undefined) {
        return alertList.filter((alert) => !!alert.resolved === resolved)
      }

      return alertList
    }

    export function resolveAlert(alertId: string): boolean {
      const alert = alerts.get(alertId)
      if (!alert) return false

      alert.resolved = true
      alert.resolvedAt = Date.now()

      log.info("Alert resolved", { alertId, alert })
      eventEmitter.emit("alert:resolved", alert)

      return true
    }

    export function clearResolvedAlerts(): number {
      let cleared = 0
      for (const [id, alert] of alerts) {
        if (alert.resolved) {
          alerts.delete(id)
          cleared++
        }
      }

      log.info("Resolved alerts cleared", { count: cleared })
      return cleared
    }

    export function clearAllAlerts(): number {
      const count = alerts.size
      alerts.clear()
      log.info("All alerts cleared", { count })
      return count
    }
  }

  // Utility functions
  function getRecentResourceUsage(windowMs: number): ResourceUsage[] {
    const cutoff = Date.now() - windowMs
    return resourceHistory.filter((r) => r.timestamp >= cutoff)
  }

  function emitAlert(alert: PerformanceAlert): void {
    alerts.set(alert.id, alert)
    log.warn("Performance alert", alert)
    eventEmitter.emit("alert", alert)
  }

  // Main monitoring functions
  export async function initialize(userConfig?: Partial<MonitorConfig>): Promise<void> {
    if (isInitialized) {
      log.warn("Monitor already initialized")
      return
    }

    const timer = log.time("Monitor initialization")

    try {
      // Merge configuration
      if (userConfig) {
        config = MonitorConfig.parse({ ...config, ...userConfig })
      }

      log.info("Initializing performance monitor", { config })

      // Start monitoring timer
      if (config.performance.sampleInterval > 0) {
        monitoringTimer = setInterval(() => {
          Resources.trackResources()
          Bottleneck.detectBottlenecks()
        }, config.performance.sampleInterval)
      }

      // Initial resource tracking
      Resources.trackResources()

      isInitialized = true
      log.info("Performance monitor initialized", {
        sampleInterval: config.performance.sampleInterval,
        bottleneckDetection: config.bottleneck.enabled,
        alertsEnabled: config.alerts.enabled,
      })
    } catch (error) {
      log.error("Failed to initialize monitor", error as Error)
      throw error
    } finally {
      timer.stop()
    }
  }

  export function getStats(): MonitorStats {
    const currentUsage = Resources.getCurrentUsage()
    const recentBottlenecks = Bottleneck.getBottlenecks(Date.now() - 300000) // Last 5 minutes
    const activeAlerts = Alerts.getAlerts(false)

    return {
      uptime: Date.now() - startTime,
      totalRequests,
      averageResponseTime: Performance.getAverageResponseTime(),
      errorRate: Performance.getErrorRate(),
      throughput: Performance.getThroughput(),
      activeConnections: currentUsage.handles.active,
      resourceUsage: currentUsage,
      recentBottlenecks,
      activeAlerts,
    }
  }

  export function getConfig(): MonitorConfig {
    return { ...config }
  }

  export async function updateConfig(newConfig: Partial<MonitorConfig>): Promise<void> {
    const oldConfig = { ...config }
    config = MonitorConfig.parse({ ...config, ...newConfig })

    log.info("Monitor configuration updated", {
      oldConfig,
      newConfig: config,
    })

    // Restart monitoring timer if interval changed
    if (oldConfig.performance.sampleInterval !== config.performance.sampleInterval) {
      if (monitoringTimer) {
        clearInterval(monitoringTimer)
        monitoringTimer = null
      }

      if (config.performance.sampleInterval > 0) {
        monitoringTimer = setInterval(() => {
          Resources.trackResources()
          Bottleneck.detectBottlenecks()
        }, config.performance.sampleInterval)
      }
    }
  }

  export function on(event: string, listener: (...args: any[]) => void): void {
    eventEmitter.on(event, listener)
  }

  export function off(event: string, listener: (...args: any[]) => void): void {
    eventEmitter.off(event, listener)
  }

  export async function shutdown(): Promise<void> {
    log.info("Shutting down performance monitor")

    if (monitoringTimer) {
      clearInterval(monitoringTimer)
      monitoringTimer = null
    }

    // Clear all data
    performanceMetrics.length = 0
    resourceHistory.length = 0
    bottlenecks.length = 0
    alerts.clear()
    operationTimes.clear()
    requestTimes.length = 0

    // Reset counters
    totalRequests = 0
    errorCount = 0
    startTime = Date.now()

    // Remove all event listeners
    eventEmitter.removeAllListeners()

    isInitialized = false
    log.info("Performance monitor shutdown complete")
  }

  // High-level monitoring utilities
  export function measureAsync<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now()

      try {
        const result = await fn()
        const duration = Date.now() - startTime
        Performance.recordOperationTime(name, duration)
        Performance.recordMetric(name, duration, "ms", tags)
        resolve(result)
      } catch (error) {
        const duration = Date.now() - startTime
        Performance.recordOperationTime(name, duration)
        Performance.recordError(error as Error, { operation: name, ...tags })
        reject(error)
      }
    })
  }

  export function measureSync<T>(name: string, fn: () => T, tags?: Record<string, string>): T {
    const startTime = Date.now()

    try {
      const result = fn()
      const duration = Date.now() - startTime
      Performance.recordOperationTime(name, duration)
      Performance.recordMetric(name, duration, "ms", tags)
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      Performance.recordOperationTime(name, duration)
      Performance.recordError(error as Error, { operation: name, ...tags })
      throw error
    }
  }

  export function createTimer(name: string, tags?: Record<string, string>) {
    const startTime = Date.now()

    return {
      stop: () => {
        const duration = Date.now() - startTime
        Performance.recordOperationTime(name, duration)
        Performance.recordMetric(name, duration, "ms", tags)
        return duration
      },
    }
  }
}
