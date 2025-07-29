export { Optimizer } from "./optimizer"
export { Cache } from "./cache"
export { Monitor } from "./monitor"

// Re-export commonly used types
export type { PerformanceMetric, MonitorStats, BottleneckInfo, PerformanceAlert, ResourceUsage } from "./monitor"

export type { CacheStats } from "./cache"

// Performance utilities namespace
export namespace Performance {
  // Initialize all performance systems
  export async function initialize(config?: {
    optimizer?: Partial<import("./optimizer").Optimizer.OptimizerConfig>
    cache?: Partial<import("./cache").Cache.CacheConfig>
    monitor?: Partial<import("./monitor").Monitor.MonitorConfig>
  }): Promise<void> {
    const { Optimizer } = await import("./optimizer")
    const { Cache } = await import("./cache")
    const { Monitor } = await import("./monitor")

    // Initialize in order: optimizer first, then cache, then monitor
    await Optimizer.initialize(config?.optimizer)
    await Cache.initialize(config?.cache)
    await Monitor.initialize(config?.monitor)
  }

  // Shutdown all performance systems
  export async function shutdown(): Promise<void> {
    const { Optimizer } = await import("./optimizer")
    const { Cache } = await import("./cache")
    const { Monitor } = await import("./monitor")

    // Shutdown in reverse order
    await Monitor.shutdown()
    await Cache.shutdown()
    await Optimizer.shutdown()
  }

  // Get combined performance stats
  export function getStats(): {
    optimizer: ReturnType<typeof Optimizer.getMetrics>
    cache: ReturnType<typeof Cache.getStats>
    monitor: ReturnType<typeof Monitor.getStats>
  } {
    const { Optimizer } = require("./optimizer")
    const { Cache } = require("./cache")
    const { Monitor } = require("./monitor")

    return {
      optimizer: Optimizer.getMetrics(),
      cache: Cache.getStats(),
      monitor: Monitor.getStats(),
    }
  }

  // Configure for production
  export async function optimizeForProduction(): Promise<void> {
    const { Optimizer } = await import("./optimizer")

    Optimizer.optimizeForProduction()

    // Update cache for production
    const { Cache } = await import("./cache")
    await Cache.updateConfig({
      request: {
        enabled: true,
        maxSize: 200,
        ttl: 600000, // 10 minutes
        keyStrategy: "hash",
      },
      response: {
        enabled: true,
        maxSize: 100,
        ttl: 1800000, // 30 minutes
        maxPayloadSize: 2 * 1024 * 1024, // 2MB
        compressionEnabled: true,
      },
      memory: {
        maxHeapUsage: 0.15, // 15% for production
        cleanupInterval: 30000, // 30 seconds
        enableWeakRefs: true,
      },
    })

    // Update monitor for production
    const { Monitor } = await import("./monitor")
    await Monitor.updateConfig({
      performance: {
        enabled: true,
        sampleInterval: 5000, // 5 seconds
        metricsRetention: 7200000, // 2 hours
        slowThreshold: 500, // 500ms
        enableProfiling: false,
      },
      alerts: {
        enabled: true,
        memoryThreshold: 0.8,
        cpuThreshold: 0.75,
        eventLoopThreshold: 50,
        responseTimeThreshold: 3000, // 3 seconds
      },
    })
  }

  // Measure function performance
  export async function measure<T>(
    name: string,
    fn: () => Promise<T>,
    options?: { useCache?: boolean; cacheKey?: string; cacheTtl?: number },
  ): Promise<T> {
    const { Monitor } = await import("./monitor")

    if (options?.useCache && options.cacheKey) {
      const { Cache } = await import("./cache")

      return Cache.wrapWithCache(options.cacheKey, () => Monitor.measureAsync(name, fn), { ttl: options.cacheTtl })
    }

    return Monitor.measureAsync(name, fn)
  }

  // Create optimized stream
  export function createStream(streamId: string) {
    const { Optimizer } = require("./optimizer")
    return Optimizer.Streaming.createOptimizedStream(streamId)
  }

  // Register lazy module
  export function registerLazyModule<T>(
    name: string,
    loader: () => Promise<T>,
    options?: { critical?: boolean; preload?: boolean },
  ): () => Promise<T> {
    const { Optimizer } = require("./optimizer")
    return Optimizer.Lazy.registerModule(name, loader, options)
  }
}
