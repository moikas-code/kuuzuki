import { z } from "zod"
import { Logger } from "../log/logger"
import { lazy } from "../util/lazy"

export namespace Optimizer {
  const log = Logger.create({ service: "optimizer" })

  // Configuration schema
  export const OptimizerConfig = z
    .object({
      startup: z
        .object({
          enableLazyLoading: z.boolean().default(true),
          preloadCriticalModules: z.boolean().default(true),
          deferNonCriticalInit: z.boolean().default(true),
          maxStartupTime: z.number().default(2000), // ms
        })
        .default({}),
      streaming: z
        .object({
          enableChunking: z.boolean().default(true),
          chunkSize: z.number().default(1024),
          bufferSize: z.number().default(8192),
          compressionThreshold: z.number().default(1024),
          enableCompression: z.boolean().default(true),
        })
        .default({}),
      memory: z
        .object({
          enableGC: z.boolean().default(true),
          gcInterval: z.number().default(30000), // ms
          maxHeapSize: z.number().default(512 * 1024 * 1024), // bytes
          enableMemoryProfiling: z.boolean().default(false),
          memoryWarningThreshold: z.number().default(0.8), // 80% of max heap
        })
        .default({}),
      lazy: z
        .object({
          enableModuleLazyLoading: z.boolean().default(true),
          enableComponentLazyLoading: z.boolean().default(true),
          preloadThreshold: z.number().default(100), // ms
        })
        .default({}),
    })
    .default({})

  export type OptimizerConfig = z.infer<typeof OptimizerConfig>

  // Performance metrics
  export interface PerformanceMetrics {
    startup: {
      totalTime: number
      moduleLoadTime: number
      initTime: number
      firstResponseTime: number
    }
    memory: {
      heapUsed: number
      heapTotal: number
      external: number
      rss: number
      gcCount: number
      gcTime: number
    }
    streaming: {
      averageChunkTime: number
      totalBytesStreamed: number
      compressionRatio: number
      activeStreams: number
    }
    lazy: {
      modulesLoaded: number
      modulesDeferred: number
      averageLoadTime: number
    }
  }

  // Global state
  let config: OptimizerConfig = OptimizerConfig.parse({})
  let startupTime = Date.now()
  let isInitialized = false
  let gcTimer: NodeJS.Timeout | null = null
  let metrics: PerformanceMetrics = {
    startup: { totalTime: 0, moduleLoadTime: 0, initTime: 0, firstResponseTime: 0 },
    memory: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, gcCount: 0, gcTime: 0 },
    streaming: { averageChunkTime: 0, totalBytesStreamed: 0, compressionRatio: 1, activeStreams: 0 },
    lazy: { modulesLoaded: 0, modulesDeferred: 0, averageLoadTime: 0 },
  }

  // Lazy loading registry
  const lazyModules = new Map<string, () => Promise<any>>()
  const loadedModules = new Set<string>()
  const loadTimes = new Map<string, number>()

  // Startup optimization
  export namespace Startup {
    const criticalModules = new Set<string>()
    const deferredInitializers = new Array<() => Promise<void>>()

    export function markCritical(moduleName: string): void {
      criticalModules.add(moduleName)
      log.debug("Marked module as critical", { module: moduleName })
    }

    export function deferInitialization(initializer: () => Promise<void>): void {
      if (config.startup.deferNonCriticalInit) {
        deferredInitializers.push(initializer)
        log.debug("Deferred initialization", { count: deferredInitializers.length })
      } else {
        // Execute immediately if deferred init is disabled
        initializer().catch((err) => log.error("Deferred initializer failed", err))
      }
    }

    export async function preloadCriticalModules(): Promise<void> {
      if (!config.startup.preloadCriticalModules) return

      const timer = log.time("Preloading critical modules")
      const startTime = Date.now()

      try {
        const preloadPromises = Array.from(criticalModules).map(async (moduleName) => {
          if (lazyModules.has(moduleName)) {
            const loader = lazyModules.get(moduleName)!
            await loader()
            loadedModules.add(moduleName)
          }
        })

        await Promise.all(preloadPromises)
        metrics.startup.moduleLoadTime = Date.now() - startTime
        log.info("Critical modules preloaded", {
          count: criticalModules.size,
          time: metrics.startup.moduleLoadTime,
        })
      } catch (error) {
        log.error("Failed to preload critical modules", error as Error)
      } finally {
        timer.stop()
      }
    }

    export async function runDeferredInitializers(): Promise<void> {
      if (deferredInitializers.length === 0) return

      const timer = log.time("Running deferred initializers")

      try {
        // Run initializers in batches to avoid overwhelming the system
        const batchSize = 3
        for (let i = 0; i < deferredInitializers.length; i += batchSize) {
          const batch = deferredInitializers.slice(i, i + batchSize)
          await Promise.all(batch.map((init) => init().catch((err) => log.error("Deferred initializer failed", err))))
        }

        log.info("Deferred initializers completed", { count: deferredInitializers.length })
      } finally {
        timer.stop()
      }
    }

    export function recordFirstResponse(): void {
      if (metrics.startup.firstResponseTime === 0) {
        metrics.startup.firstResponseTime = Date.now() - startupTime
        log.info("First response recorded", { time: metrics.startup.firstResponseTime })
      }
    }
  }

  // Response streaming optimization
  export namespace Streaming {
    interface StreamContext {
      id: string
      startTime: number
      bytesStreamed: number
      chunkCount: number
    }

    const activeStreams = new Map<string, StreamContext>()

    export function createOptimizedStream(streamId: string) {
      const context: StreamContext = {
        id: streamId,
        startTime: Date.now(),
        bytesStreamed: 0,
        chunkCount: 0,
      }

      activeStreams.set(streamId, context)
      metrics.streaming.activeStreams = activeStreams.size

      return {
        write: (data: string | Buffer) => {
          const chunk = typeof data === "string" ? Buffer.from(data) : data
          context.bytesStreamed += chunk.length
          context.chunkCount++
          metrics.streaming.totalBytesStreamed += chunk.length

          // Apply compression if enabled and data exceeds threshold
          if (config.streaming.enableCompression && chunk.length > config.streaming.compressionThreshold) {
            return compressChunk(chunk)
          }

          return chunk
        },

        end: () => {
          const duration = Date.now() - context.startTime
          const avgChunkTime = duration / Math.max(context.chunkCount, 1)

          // Update metrics
          metrics.streaming.averageChunkTime = (metrics.streaming.averageChunkTime + avgChunkTime) / 2

          activeStreams.delete(streamId)
          metrics.streaming.activeStreams = activeStreams.size

          log.debug("Stream completed", {
            streamId,
            duration,
            bytesStreamed: context.bytesStreamed,
            chunkCount: context.chunkCount,
            avgChunkTime,
          })
        },
      }
    }

    function compressChunk(chunk: Buffer): Buffer {
      // Simple compression simulation - in real implementation, use zlib
      const compressionRatio = 0.7 // Assume 30% compression
      metrics.streaming.compressionRatio = compressionRatio
      return chunk // Return original for now
    }

    export function optimizeStreamingResponse(data: any): any {
      if (!config.streaming.enableChunking) return data

      // For large responses, implement chunking
      if (typeof data === "string" && data.length > config.streaming.chunkSize) {
        return chunkData(data)
      }

      return data
    }

    function chunkData(data: string): string[] {
      const chunks: string[] = []
      const chunkSize = config.streaming.chunkSize

      for (let i = 0; i < data.length; i += chunkSize) {
        chunks.push(data.slice(i, i + chunkSize))
      }

      return chunks
    }
  }

  // Memory optimization
  export namespace Memory {
    let gcCount = 0

    export function startMemoryOptimization(): void {
      if (!config.memory.enableGC) return

      // Set up periodic garbage collection
      gcTimer = setInterval(() => {
        performOptimizedGC()
      }, config.memory.gcInterval)

      // Monitor memory usage
      setInterval(() => {
        updateMemoryMetrics()
        checkMemoryThreshold()
      }, 5000) // Check every 5 seconds

      log.info("Memory optimization started", {
        gcInterval: config.memory.gcInterval,
        maxHeapSize: config.memory.maxHeapSize,
      })
    }

    export function stopMemoryOptimization(): void {
      if (gcTimer) {
        clearInterval(gcTimer)
        gcTimer = null
      }
    }

    function performOptimizedGC(): void {
      const startTime = Date.now()

      if (global.gc) {
        global.gc()
        gcCount++
        const gcTime = Date.now() - startTime

        metrics.memory.gcCount = gcCount
        metrics.memory.gcTime += gcTime

        log.debug("Garbage collection performed", {
          gcTime,
          totalGcTime: metrics.memory.gcTime,
          gcCount,
        })
      }
    }

    function updateMemoryMetrics(): void {
      const memUsage = process.memoryUsage()
      metrics.memory = {
        ...metrics.memory,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      }
    }

    function checkMemoryThreshold(): void {
      const heapUsageRatio = metrics.memory.heapUsed / config.memory.maxHeapSize

      if (heapUsageRatio > config.memory.memoryWarningThreshold) {
        log.warn("Memory usage threshold exceeded", {
          heapUsed: metrics.memory.heapUsed,
          heapTotal: metrics.memory.heapTotal,
          usageRatio: heapUsageRatio,
          threshold: config.memory.memoryWarningThreshold,
        })

        // Trigger immediate GC if available
        if (global.gc && heapUsageRatio > 0.9) {
          performOptimizedGC()
        }
      }
    }

    export function optimizeMemoryUsage<T>(data: T): T {
      // For large objects, consider implementing object pooling or weak references
      if (typeof data === "object" && data !== null) {
        // Implement memory optimization strategies here
        return data
      }
      return data
    }
  }

  // Lazy loading mechanisms
  export namespace Lazy {
    export function registerModule<T>(
      name: string,
      loader: () => Promise<T>,
      options: { critical?: boolean; preload?: boolean } = {},
    ): () => Promise<T> {
      if (options.critical) {
        Startup.markCritical(name)
      }

      const lazyLoader = lazy(async () => {
        const startTime = Date.now()

        try {
          log.debug("Loading lazy module", { module: name })
          const module = await loader()

          const loadTime = Date.now() - startTime
          loadTimes.set(name, loadTime)
          loadedModules.add(name)

          // Update metrics
          metrics.lazy.modulesLoaded++
          const totalLoadTime = Array.from(loadTimes.values()).reduce((a, b) => a + b, 0)
          metrics.lazy.averageLoadTime = totalLoadTime / loadTimes.size

          log.info("Lazy module loaded", { module: name, loadTime })
          return module
        } catch (error) {
          log.error("Failed to load lazy module", error as Error, { module: name })
          throw error
        }
      })

      lazyModules.set(name, lazyLoader)

      // Preload if requested and threshold is met
      if (options.preload && config.lazy.preloadThreshold > 0) {
        setTimeout(() => {
          lazyLoader().catch((err) => log.error("Preload failed", err, { module: name }))
        }, config.lazy.preloadThreshold)
      }

      return lazyLoader
    }

    export function createLazyComponent<T>(name: string, factory: () => Promise<T>): () => Promise<T> {
      return registerModule(name, factory, { critical: false })
    }

    export function isModuleLoaded(name: string): boolean {
      return loadedModules.has(name)
    }

    export function getLoadedModules(): string[] {
      return Array.from(loadedModules)
    }

    export function getDeferredModules(): string[] {
      return Array.from(lazyModules.keys()).filter((name) => !loadedModules.has(name))
    }
  }

  // Main initialization
  export async function initialize(userConfig?: Partial<OptimizerConfig>): Promise<void> {
    if (isInitialized) {
      log.warn("Optimizer already initialized")
      return
    }

    const timer = log.time("Optimizer initialization")

    try {
      // Merge configuration
      if (userConfig) {
        config = OptimizerConfig.parse({ ...config, ...userConfig })
      }

      log.info("Initializing performance optimizer", { config })

      // Start memory optimization
      Memory.startMemoryOptimization()

      // Preload critical modules
      await Startup.preloadCriticalModules()

      // Defer non-critical initialization
      Startup.deferInitialization(async () => {
        await Startup.runDeferredInitializers()
      })

      metrics.startup.initTime = Date.now() - startupTime
      isInitialized = true

      log.info("Performance optimizer initialized", {
        initTime: metrics.startup.initTime,
      })
    } catch (error) {
      log.error("Failed to initialize optimizer", error as Error)
      throw error
    } finally {
      timer.stop()
    }
  }

  export function getMetrics(): PerformanceMetrics {
    // Update startup total time
    if (metrics.startup.totalTime === 0 && isInitialized) {
      metrics.startup.totalTime = Date.now() - startupTime
    }

    return { ...metrics }
  }

  export function getConfig(): OptimizerConfig {
    return { ...config }
  }

  export async function updateConfig(newConfig: Partial<OptimizerConfig>): Promise<void> {
    const oldConfig = { ...config }
    config = OptimizerConfig.parse({ ...config, ...newConfig })

    log.info("Optimizer configuration updated", {
      oldConfig: oldConfig,
      newConfig: config,
    })

    // Restart memory optimization if settings changed
    if (
      oldConfig.memory.enableGC !== config.memory.enableGC ||
      oldConfig.memory.gcInterval !== config.memory.gcInterval
    ) {
      Memory.stopMemoryOptimization()
      Memory.startMemoryOptimization()
    }
  }

  export async function shutdown(): Promise<void> {
    log.info("Shutting down performance optimizer")

    Memory.stopMemoryOptimization()

    // Clear lazy module registry
    lazyModules.clear()
    loadedModules.clear()
    loadTimes.clear()

    isInitialized = false
    log.info("Performance optimizer shutdown complete")
  }

  // Utility functions
  export function measurePerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const timer = log.time(`Performance measurement: ${name}`)

      try {
        const result = await fn()
        resolve(result)
      } catch (error) {
        reject(error)
      } finally {
        timer.stop()
      }
    })
  }

  export function optimizeForProduction(): void {
    updateConfig({
      startup: {
        enableLazyLoading: true,
        preloadCriticalModules: true,
        deferNonCriticalInit: true,
        maxStartupTime: 1500,
      },
      streaming: {
        enableChunking: true,
        enableCompression: true,
        chunkSize: 2048,
        bufferSize: 16384,
        compressionThreshold: 512,
      },
      memory: {
        enableGC: true,
        gcInterval: 20000,
        maxHeapSize: 1024 * 1024 * 1024,
        enableMemoryProfiling: false,
        memoryWarningThreshold: 0.85,
      },
      lazy: {
        enableModuleLazyLoading: true,
        enableComponentLazyLoading: true,
        preloadThreshold: 50,
      },
    })

    log.info("Optimizer configured for production")
  }
}
