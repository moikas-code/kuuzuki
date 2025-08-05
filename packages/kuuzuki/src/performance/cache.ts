import { z } from "zod"
import { Logger } from "../log/logger"

export namespace Cache {
  const log = Logger.create({ service: "cache" })

  // Cache configuration schema
  export const CacheConfig = z
    .object({
      request: z
        .object({
          enabled: z.boolean().default(true),
          maxSize: z.number().default(100), // max number of cached requests
          ttl: z.number().default(300000), // 5 minutes in ms
          keyStrategy: z.enum(["url", "hash", "custom"]).default("hash"),
        })
        .default({}),
      response: z
        .object({
          enabled: z.boolean().default(true),
          maxSize: z.number().default(50), // max number of cached responses
          ttl: z.number().default(600000), // 10 minutes in ms
          maxPayloadSize: z.number().default(1024 * 1024), // 1MB max cached response size
          compressionEnabled: z.boolean().default(true),
        })
        .default({}),
      memory: z
        .object({
          maxHeapUsage: z.number().default(0.1), // 10% of available heap
          cleanupInterval: z.number().default(60000), // 1 minute
          enableWeakRefs: z.boolean().default(true),
        })
        .default({}),
      invalidation: z
        .object({
          strategy: z.enum(["ttl", "lru", "manual", "hybrid"]).default("hybrid"),
          maxAge: z.number().default(3600000), // 1 hour
          accessThreshold: z.number().default(5), // min access count to keep
        })
        .default({}),
    })
    .default({})

  export type CacheConfig = z.infer<typeof CacheConfig>

  // Cache entry interface
  interface CacheEntry<T = any> {
    key: string
    value: T
    timestamp: number
    ttl: number
    accessCount: number
    lastAccessed: number
    size: number
    compressed?: boolean
  }

  // Cache statistics
  export interface CacheStats {
    requests: {
      hits: number
      misses: number
      hitRate: number
      totalRequests: number
    }
    responses: {
      hits: number
      misses: number
      hitRate: number
      totalResponses: number
    }
    memory: {
      usedBytes: number
      maxBytes: number
      entryCount: number
      compressionRatio: number
    }
    performance: {
      averageGetTime: number
      averageSetTime: number
      cleanupTime: number
    }
  }

  // Global cache state
  let config: CacheConfig = CacheConfig.parse({})
  let isInitialized = false
  let cleanupTimer: NodeJS.Timeout | null = null
  let initializationInProgress = false

  // Cache stores
  const requestCache = new Map<string, CacheEntry>()
  const responseCache = new Map<string, CacheEntry>()
  const weakRefCache = new Map<string, WeakRef<any>>()

  // Statistics
  let stats: CacheStats = {
    requests: { hits: 0, misses: 0, hitRate: 0, totalRequests: 0 },
    responses: { hits: 0, misses: 0, hitRate: 0, totalResponses: 0 },
    memory: { usedBytes: 0, maxBytes: 0, entryCount: 0, compressionRatio: 1 },
    performance: { averageGetTime: 0, averageSetTime: 0, cleanupTime: 0 },
  }

  // Request caching
  export namespace Request {
    export function generateKey(method: string, url: string, headers?: Record<string, string>, body?: any): string {
      switch (config.request.keyStrategy) {
        case "url":
          return `${method}:${url}`
        case "hash":
          const content = JSON.stringify({ method, url, headers, body })
          return hashString(content)
        case "custom":
          // Allow custom key generation - for now use hash
          return hashString(JSON.stringify({ method, url, headers, body }))
        default:
          return `${method}:${url}`
      }
    }

    export function get<T = any>(key: string): T | null {
      if (!config.request.enabled) return null

      const startTime = Date.now()
      const entry = requestCache.get(key)

      if (!entry) {
        stats.requests.misses++
        stats.requests.totalRequests++
        updateHitRate("requests")
        return null
      }

      // Check TTL
      if (Date.now() - entry.timestamp > entry.ttl) {
        requestCache.delete(key)
        stats.requests.misses++
        stats.requests.totalRequests++
        updateHitRate("requests")
        log.debug("Request cache entry expired", { key })
        return null
      }

      // Update access statistics
      entry.accessCount++
      entry.lastAccessed = Date.now()

      stats.requests.hits++
      stats.requests.totalRequests++
      updateHitRate("requests")

      const getTime = Date.now() - startTime
      updatePerformanceStats("get", getTime)

      log.debug("Request cache hit", { key, accessCount: entry.accessCount })
      return entry.value
    }

    export function set<T = any>(key: string, value: T, customTtl?: number): void {
      if (!config.request.enabled) return

      const startTime = Date.now()
      const ttl = customTtl || config.request.ttl
      const size = estimateSize(value)

      // Check cache size limits
      if (requestCache.size >= config.request.maxSize) {
        evictLeastRecentlyUsed(requestCache)
      }

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl,
        accessCount: 0,
        lastAccessed: Date.now(),
        size,
      }

      requestCache.set(key, entry)
      updateMemoryStats()

      const setTime = Date.now() - startTime
      updatePerformanceStats("set", setTime)

      log.debug("Request cached", { key, size, ttl })
    }

    export function invalidate(key: string): boolean {
      const deleted = requestCache.delete(key)
      if (deleted) {
        updateMemoryStats()
        log.debug("Request cache invalidated", { key })
      }
      return deleted
    }

    export function clear(): void {
      const count = requestCache.size
      requestCache.clear()
      updateMemoryStats()
      log.info("Request cache cleared", { entriesRemoved: count })
    }
  }

  // Response caching
  export namespace Response {
    export function get<T = any>(key: string): T | null {
      if (!config.response.enabled) return null

      const startTime = Date.now()
      const entry = responseCache.get(key)

      if (!entry) {
        stats.responses.misses++
        stats.responses.totalResponses++
        updateHitRate("responses")
        return null
      }

      // Check TTL
      if (Date.now() - entry.timestamp > entry.ttl) {
        responseCache.delete(key)
        stats.responses.misses++
        stats.responses.totalResponses++
        updateHitRate("responses")
        log.debug("Response cache entry expired", { key })
        return null
      }

      // Update access statistics
      entry.accessCount++
      entry.lastAccessed = Date.now()

      stats.responses.hits++
      stats.responses.totalResponses++
      updateHitRate("responses")

      const getTime = Date.now() - startTime
      updatePerformanceStats("get", getTime)

      let value = entry.value

      // Decompress if needed
      if (entry.compressed && config.response.compressionEnabled) {
        value = decompressValue(value) as T
      }

      log.debug("Response cache hit", {
        key,
        accessCount: entry.accessCount,
        compressed: entry.compressed,
      })
      return value
    }

    export function set<T = any>(key: string, value: T, customTtl?: number): void {
      if (!config.response.enabled) return

      const startTime = Date.now()
      const ttl = customTtl || config.response.ttl
      let size = estimateSize(value)
      let compressed = false
      let finalValue = value

      // Check payload size limit
      if (size > config.response.maxPayloadSize) {
        log.warn("Response too large for cache", { key, size, limit: config.response.maxPayloadSize })
        return
      }

      // Compress large responses if enabled
      if (config.response.compressionEnabled && size > 1024) {
        finalValue = compressValue(value) as T
        const compressedSize = estimateSize(finalValue)
        if (compressedSize < size * 0.8) {
          // Only use compression if it saves at least 20%
          compressed = true
          size = compressedSize
          stats.memory.compressionRatio = size / estimateSize(value)
        } else {
          finalValue = value // Use original if compression doesn't help much
        }
      }

      // Check cache size limits
      if (responseCache.size >= config.response.maxSize) {
        evictLeastRecentlyUsed(responseCache)
      }

      const entry: CacheEntry<T> = {
        key,
        value: finalValue,
        timestamp: Date.now(),
        ttl,
        accessCount: 0,
        lastAccessed: Date.now(),
        size,
        compressed,
      }

      responseCache.set(key, entry)
      updateMemoryStats()

      const setTime = Date.now() - startTime
      updatePerformanceStats("set", setTime)

      log.debug("Response cached", {
        key,
        size,
        ttl,
        compressed,
        compressionRatio: compressed ? stats.memory.compressionRatio : 1,
      })
    }

    export function invalidate(key: string): boolean {
      const deleted = responseCache.delete(key)
      if (deleted) {
        updateMemoryStats()
        log.debug("Response cache invalidated", { key })
      }
      return deleted
    }

    export function clear(): void {
      const count = responseCache.size
      responseCache.clear()
      updateMemoryStats()
      log.info("Response cache cleared", { entriesRemoved: count })
    }
  }

  // Cache invalidation strategies
  export namespace Invalidation {
    export function invalidateByPattern(pattern: RegExp): number {
      let count = 0

      // Invalidate matching request cache entries
      for (const [key] of requestCache) {
        if (pattern.test(key)) {
          requestCache.delete(key)
          count++
        }
      }

      // Invalidate matching response cache entries
      for (const [key] of responseCache) {
        if (pattern.test(key)) {
          responseCache.delete(key)
          count++
        }
      }

      updateMemoryStats()
      log.info("Pattern-based cache invalidation", { pattern: pattern.source, count })
      return count
    }

    export function invalidateByTag(tag: string): number {
      // For now, implement simple tag-based invalidation
      // In a real implementation, you'd store tags with entries
      const pattern = new RegExp(`.*${tag}.*`)
      return invalidateByPattern(pattern)
    }

    export function invalidateExpired(): number {
      let count = 0
      const now = Date.now()

      // Clean expired request cache entries
      for (const [key, entry] of requestCache) {
        if (now - entry.timestamp > entry.ttl) {
          requestCache.delete(key)
          count++
        }
      }

      // Clean expired response cache entries
      for (const [key, entry] of responseCache) {
        if (now - entry.timestamp > entry.ttl) {
          responseCache.delete(key)
          count++
        }
      }

      updateMemoryStats()
      if (count > 0) {
        log.debug("Expired cache entries cleaned", { count })
      }
      return count
    }

    export function invalidateByAge(maxAge: number): number {
      let count = 0
      const cutoff = Date.now() - maxAge

      // Clean old request cache entries
      for (const [key, entry] of requestCache) {
        if (entry.timestamp < cutoff) {
          requestCache.delete(key)
          count++
        }
      }

      // Clean old response cache entries
      for (const [key, entry] of responseCache) {
        if (entry.timestamp < cutoff) {
          responseCache.delete(key)
          count++
        }
      }

      updateMemoryStats()
      if (count > 0) {
        log.debug("Age-based cache cleanup", { maxAge, count })
      }
      return count
    }

    export function invalidateByAccessCount(minAccessCount: number): number {
      let count = 0

      // Clean underused request cache entries
      for (const [key, entry] of requestCache) {
        if (entry.accessCount < minAccessCount) {
          requestCache.delete(key)
          count++
        }
      }

      // Clean underused response cache entries
      for (const [key, entry] of responseCache) {
        if (entry.accessCount < minAccessCount) {
          responseCache.delete(key)
          count++
        }
      }

      updateMemoryStats()
      if (count > 0) {
        log.debug("Access-based cache cleanup", { minAccessCount, count })
      }
      return count
    }
  }

  // Memory-efficient caching utilities
  export namespace Memory {
    export function getUsage(): { used: number; max: number; percentage: number } {
      const memUsage = process.memoryUsage()
      const used = stats.memory.usedBytes
      const max = memUsage.heapTotal * config.memory.maxHeapUsage
      const percentage = max > 0 ? (used / max) * 100 : 0

      return { used, max, percentage }
    }

    export function isMemoryPressure(): boolean {
      const usage = getUsage()
      return usage.percentage > 80 // Consider 80% as memory pressure
    }

    export function cleanup(): number {
      const startTime = Date.now()
      let cleaned = 0

      // First, clean expired entries
      cleaned += Invalidation.invalidateExpired()

      // If still under memory pressure, use more aggressive cleanup
      if (isMemoryPressure()) {
        // Clean entries with low access count
        cleaned += Invalidation.invalidateByAccessCount(config.invalidation.accessThreshold)

        // Clean old entries
        cleaned += Invalidation.invalidateByAge(config.invalidation.maxAge)
      }

      // Clean weak references
      if (config.memory.enableWeakRefs) {
        cleaned += cleanupWeakRefs()
      }

      const cleanupTime = Date.now() - startTime
      updatePerformanceStats("cleanup", cleanupTime)

      if (cleaned > 0) {
        log.info("Memory cleanup completed", {
          entriesRemoved: cleaned,
          cleanupTime,
          memoryUsage: getUsage(),
        })
      }

      return cleaned
    }

    function cleanupWeakRefs(): number {
      let cleaned = 0
      for (const [key, weakRef] of weakRefCache) {
        if (!weakRef.deref()) {
          weakRefCache.delete(key)
          cleaned++
        }
      }
      return cleaned
    }

    export function setWeakRef<T extends object>(key: string, value: T): void {
      if (config.memory.enableWeakRefs) {
        weakRefCache.set(key, new WeakRef(value))
      }
    }

    export function getWeakRef<T extends object>(key: string): T | null {
      if (!config.memory.enableWeakRefs) return null

      const weakRef = weakRefCache.get(key)
      if (!weakRef) return null

      const value = weakRef.deref()
      if (!value) {
        weakRefCache.delete(key)
        return null
      }

      return value as T
    }
  }

  // Utility functions
  function hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  function estimateSize(obj: any): number {
    if (obj === null || obj === undefined) return 0
    if (typeof obj === "string") return obj.length * 2 // Rough estimate for UTF-16
    if (typeof obj === "number") return 8
    if (typeof obj === "boolean") return 4
    if (obj instanceof Buffer) return obj.length

    // For objects, rough JSON size estimate
    try {
      return JSON.stringify(obj).length * 2
    } catch {
      return 1024 // Default estimate for non-serializable objects
    }
  }

  function compressValue(value: any): string {
    // Simple compression simulation - in real implementation, use zlib
    const json = JSON.stringify(value)
    // Simulate compression by removing whitespace and common patterns
    return json.replace(/\s+/g, "").replace(/"/g, "'")
  }

  function decompressValue(compressed: string): any {
    // Simple decompression simulation
    try {
      const restored = compressed.replace(/'/g, '"')
      return JSON.parse(restored)
    } catch {
      return compressed
    }
  }

  function evictLeastRecentlyUsed(cache: Map<string, CacheEntry>): void {
    let oldestKey = ""
    let oldestTime = Date.now()

    for (const [key, entry] of cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey)
      log.debug("LRU eviction", { key: oldestKey, lastAccessed: oldestTime })
    }
  }

  function updateHitRate(type: "requests" | "responses"): void {
    const stat = stats[type]
    if (type === "requests") {
      const requestStat = stat as typeof stats.requests
      requestStat.hitRate = requestStat.totalRequests > 0 ? (requestStat.hits / requestStat.totalRequests) * 100 : 0
    } else {
      const responseStat = stat as typeof stats.responses
      responseStat.hitRate =
        responseStat.totalResponses > 0 ? (responseStat.hits / responseStat.totalResponses) * 100 : 0
    }
  }

  function updateMemoryStats(): void {
    let totalSize = 0
    let totalEntries = 0

    for (const entry of requestCache.values()) {
      totalSize += entry.size
      totalEntries++
    }

    for (const entry of responseCache.values()) {
      totalSize += entry.size
      totalEntries++
    }

    stats.memory.usedBytes = totalSize
    stats.memory.entryCount = totalEntries
    stats.memory.maxBytes = process.memoryUsage().heapTotal * config.memory.maxHeapUsage
  }

  function updatePerformanceStats(operation: "get" | "set" | "cleanup", time: number): void {
    switch (operation) {
      case "get":
        stats.performance.averageGetTime = (stats.performance.averageGetTime + time) / 2
        break
      case "set":
        stats.performance.averageSetTime = (stats.performance.averageSetTime + time) / 2
        break
      case "cleanup":
        stats.performance.cleanupTime = time
        break
    }
  }

  // Main cache management
  export async function initialize(userConfig?: Partial<CacheConfig>): Promise<void> {
    if (isInitialized) {
      log.warn("Cache already initialized")
      return
    }
    
    if (initializationInProgress) {
      log.warn("Cache initialization already in progress")
      return
    }
    
    initializationInProgress = true

    const timer = log.time("Cache initialization")

    try {
      // Merge configuration
      if (userConfig) {
        config = CacheConfig.parse({ ...config, ...userConfig })
      }

      log.info("Initializing cache system", { config })

      // Start cleanup timer (clear existing timer first to prevent leaks)
      if (cleanupTimer) {
        clearInterval(cleanupTimer)
        cleanupTimer = null
      }
      if (config.memory.cleanupInterval > 0) {
        cleanupTimer = setInterval(() => {
          Memory.cleanup()
        }, config.memory.cleanupInterval)
      }

      // Initialize memory stats
      updateMemoryStats()

      isInitialized = true
      initializationInProgress = false
      log.info("Cache system initialized", {
        requestCacheEnabled: config.request.enabled,
        responseCacheEnabled: config.response.enabled,
        cleanupInterval: config.memory.cleanupInterval,
      })
    } catch (error) {
      initializationInProgress = false
      log.error("Failed to initialize cache", error as Error)
      throw error
    } finally {
      timer.stop()
    }
  }

  export function getStats(): CacheStats {
    updateMemoryStats()
    return { ...stats }
  }

  export function getConfig(): CacheConfig {
    return { ...config }
  }

  export async function updateConfig(newConfig: Partial<CacheConfig>): Promise<void> {
    const oldConfig = { ...config }
    config = CacheConfig.parse({ ...config, ...newConfig })

    log.info("Cache configuration updated", {
      oldConfig,
      newConfig: config,
    })

    // Restart cleanup timer if interval changed
    if (oldConfig.memory.cleanupInterval !== config.memory.cleanupInterval) {
      if (cleanupTimer) {
        clearInterval(cleanupTimer)
        cleanupTimer = null
      }

      if (config.memory.cleanupInterval > 0) {
        cleanupTimer = setInterval(() => {
          Memory.cleanup()
        }, config.memory.cleanupInterval)
      }
    }
  }

  export async function shutdown(): Promise<void> {
    log.info("Shutting down cache system")

    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = null
    }

    // Clear all caches
    Request.clear()
    Response.clear()
    weakRefCache.clear()

    // Reset stats
    stats = {
      requests: { hits: 0, misses: 0, hitRate: 0, totalRequests: 0 },
      responses: { hits: 0, misses: 0, hitRate: 0, totalResponses: 0 },
      memory: { usedBytes: 0, maxBytes: 0, entryCount: 0, compressionRatio: 1 },
      performance: { averageGetTime: 0, averageSetTime: 0, cleanupTime: 0 },
    }

    isInitialized = false
    log.info("Cache system shutdown complete")
  }

  // High-level cache utilities
  export function createCacheKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(":")}`
  }

  export function wrapWithCache<T>(
    key: string,
    fn: () => Promise<T>,
    options: { ttl?: number; useResponseCache?: boolean } = {},
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const cache = options.useResponseCache ? Response : Request

      // Try to get from cache first
      const cached = cache.get<T>(key)
      if (cached !== null) {
        resolve(cached)
        return
      }

      try {
        // Execute function and cache result
        const result = await fn()
        cache.set(key, result, options.ttl)
        resolve(result)
      } catch (error) {
      initializationInProgress = false
        reject(error)
      }
    })
  }

  export function invalidateAll(): void {
    Request.clear()
    Response.clear()
    weakRefCache.clear()
    log.info("All caches invalidated")
  }
}
