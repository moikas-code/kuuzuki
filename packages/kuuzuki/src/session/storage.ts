import { Log } from "../util/log"
import { Config } from "../config/config"
import { z } from "zod"
import { Storage as BaseStorage } from "../storage/storage"
import { createHash } from "crypto"
import { gzipSync, gunzipSync } from "zlib"

/**
 * Session Storage System
 *
 * Provides multiple storage backends with compression and encryption
 * capabilities for session persistence data.
 */
export namespace SessionStorage {
  const log = Log.create({ service: "session-storage" })

  // Storage configuration schema
  export const StorageConfig = z.object({
    backend: z.enum(["file", "memory", "database"]).default("file"),
    compression: z.object({
      enabled: z.boolean().default(true),
      algorithm: z.enum(["gzip", "brotli"]).default("gzip"),
      threshold: z.number().default(1024), // bytes
    }),
    encryption: z.object({
      enabled: z.boolean().default(false),
      algorithm: z.enum(["aes-256-gcm"]).default("aes-256-gcm"),
      keyDerivation: z.enum(["pbkdf2", "scrypt"]).default("pbkdf2"),
    }),
    cache: z.object({
      enabled: z.boolean().default(true),
      maxSize: z.number().default(100), // number of items
      ttl: z.number().default(5 * 60 * 1000), // 5 minutes
    }),
  })
  export type StorageConfig = z.infer<typeof StorageConfig>

  // Storage metadata
  export const StorageMetadata = z.object({
    key: z.string(),
    size: z.number(),
    compressed: z.boolean(),
    encrypted: z.boolean(),
    checksum: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    accessCount: z.number(),
    lastAccessed: z.number(),
  })
  export type StorageMetadata = z.infer<typeof StorageMetadata>

  // Storage options for operations
  export const StorageOptions = z.object({
    compress: z.boolean().optional(),
    encrypt: z.boolean().optional(),
    ttl: z.number().optional(),
    metadata: z.record(z.any()).optional(),
  })
  export type StorageOptions = z.infer<typeof StorageOptions>

  /**
   * Abstract storage backend interface
   */
  export abstract class StorageBackend {
    protected config: StorageConfig
    protected log: ReturnType<typeof Log.create>

    constructor(config: StorageConfig) {
      this.config = config
      this.log = Log.create({ service: `storage-${config.backend}` })
    }

    abstract store(key: string, data: any, options?: StorageOptions): Promise<StorageMetadata>
    abstract retrieve<T = any>(key: string): Promise<T | null>
    abstract remove(key: string): Promise<void>
    abstract list(prefix?: string): Promise<string[]>
    abstract exists(key: string): Promise<boolean>
    abstract getMetadata(key: string): Promise<StorageMetadata | null>
    abstract cleanup(): Promise<{ removedKeys: number; freedSpace: number }>
  }

  /**
   * File-based storage backend using the existing Storage system
   */
  export class FileStorageBackend extends StorageBackend {
    private cache = new Map<string, { data: any; metadata: StorageMetadata; expires: number }>()

    async store(key: string, data: any, options: StorageOptions = {}): Promise<StorageMetadata> {
      try {
        const serialized = JSON.stringify(data)
        let processedData = serialized
        let compressed = false
        let encrypted = false

        // Apply compression if enabled and data exceeds threshold
        if (
          (options.compress ?? this.config.compression.enabled) &&
          serialized.length > this.config.compression.threshold
        ) {
          processedData = this.compress(serialized)
          compressed = true
        }

        // Apply encryption if enabled
        if (options.encrypt ?? this.config.encryption.enabled) {
          processedData = await this.encrypt(processedData)
          encrypted = true
        }

        // Calculate checksum
        const checksum = this.calculateChecksum(processedData)

        // Create metadata
        const metadata: StorageMetadata = {
          key,
          size: processedData.length,
          compressed,
          encrypted,
          checksum,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          accessCount: 0,
          lastAccessed: Date.now(),
        }

        // Store data and metadata
        await BaseStorage.writeJSON(key, {
          data: processedData,
          metadata,
        })

        // Update cache if enabled
        if (this.config.cache.enabled) {
          const expires = Date.now() + (options.ttl ?? this.config.cache.ttl)
          this.cache.set(key, { data, metadata, expires })
          this.cleanupCache()
        }

        this.log.debug("Data stored", { key, size: metadata.size, compressed, encrypted })
        return metadata
      } catch (error) {
        this.log.error("Failed to store data", { key, error })
        throw error
      }
    }

    async retrieve<T = any>(key: string): Promise<T | null> {
      try {
        // Check cache first
        if (this.config.cache.enabled) {
          const cached = this.cache.get(key)
          if (cached && cached.expires > Date.now()) {
            cached.metadata.accessCount++
            cached.metadata.lastAccessed = Date.now()
            this.log.debug("Data retrieved from cache", { key })
            return cached.data as T
          }
        }

        // Retrieve from storage
        const stored = await BaseStorage.readJSON<{
          data: string
          metadata: StorageMetadata
        }>(key)

        if (!stored) {
          return null
        }

        let processedData = stored.data

        // Decrypt if needed
        if (stored.metadata.encrypted) {
          processedData = await this.decrypt(processedData)
        }

        // Decompress if needed
        if (stored.metadata.compressed) {
          processedData = this.decompress(processedData)
        }

        // Verify checksum
        const expectedChecksum = this.calculateChecksum(stored.data)
        if (expectedChecksum !== stored.metadata.checksum) {
          throw new Error(`Checksum mismatch for key ${key}`)
        }

        // Parse data
        const data = JSON.parse(processedData) as T

        // Update metadata
        stored.metadata.accessCount++
        stored.metadata.lastAccessed = Date.now()
        await BaseStorage.writeJSON(key, stored)

        // Update cache
        if (this.config.cache.enabled) {
          const expires = Date.now() + this.config.cache.ttl
          this.cache.set(key, { data, metadata: stored.metadata, expires })
        }

        this.log.debug("Data retrieved", { key, size: stored.metadata.size })
        return data
      } catch (error) {
        if ((error as any)?.code === "ENOENT") {
          return null
        }
        this.log.error("Failed to retrieve data", { key, error })
        throw error
      }
    }

    async remove(key: string): Promise<void> {
      try {
        await BaseStorage.remove(key)
        this.cache.delete(key)
        this.log.debug("Data removed", { key })
      } catch (error) {
        this.log.error("Failed to remove data", { key, error })
        throw error
      }
    }

    async list(prefix = ""): Promise<string[]> {
      try {
        return BaseStorage.list(prefix)
      } catch (error) {
        this.log.error("Failed to list keys", { prefix, error })
        throw error
      }
    }

    async exists(key: string): Promise<boolean> {
      try {
        const data = await this.retrieve(key)
        return data !== null
      } catch (error) {
        return false
      }
    }

    async getMetadata(key: string): Promise<StorageMetadata | null> {
      try {
        const stored = await BaseStorage.readJSON<{
          data: string
          metadata: StorageMetadata
        }>(key)
        return stored?.metadata || null
      } catch (error) {
        return null
      }
    }

    async cleanup(): Promise<{ removedKeys: number; freedSpace: number }> {
      let removedKeys = 0
      let freedSpace = 0

      try {
        const keys = await this.list()
        const now = Date.now()

        for (const key of keys) {
          const metadata = await this.getMetadata(key)
          if (!metadata) continue

          // Remove expired items (if TTL was set)
          const age = now - metadata.lastAccessed
          if (age > 30 * 24 * 60 * 60 * 1000) {
            // 30 days
            await this.remove(key)
            removedKeys++
            freedSpace += metadata.size
          }
        }

        // Cleanup cache
        this.cleanupCache()

        this.log.info("Storage cleanup completed", { removedKeys, freedSpace })
        return { removedKeys, freedSpace }
      } catch (error) {
        this.log.error("Storage cleanup failed", { error })
        return { removedKeys: 0, freedSpace: 0 }
      }
    }

    private compress(data: string): string {
      switch (this.config.compression.algorithm) {
        case "gzip":
          return gzipSync(Buffer.from(data)).toString("base64")
        default:
          throw new Error(`Unsupported compression algorithm: ${this.config.compression.algorithm}`)
      }
    }

    private decompress(data: string): string {
      switch (this.config.compression.algorithm) {
        case "gzip":
          return gunzipSync(Buffer.from(data, "base64")).toString()
        default:
          throw new Error(`Unsupported compression algorithm: ${this.config.compression.algorithm}`)
      }
    }

    private async encrypt(data: string): Promise<string> {
      // For now, return data as-is since encryption requires key management
      // In a real implementation, this would use the configured encryption algorithm
      this.log.warn("Encryption requested but not implemented")
      return data
    }

    private async decrypt(data: string): Promise<string> {
      // For now, return data as-is since encryption requires key management
      // In a real implementation, this would use the configured encryption algorithm
      this.log.warn("Decryption requested but not implemented")
      return data
    }

    private calculateChecksum(data: string): string {
      return createHash("sha256").update(data).digest("hex")
    }

    private cleanupCache(): void {
      if (!this.config.cache.enabled) return

      const now = Date.now()
      const entries = Array.from(this.cache.entries())

      // Remove expired entries
      for (const [key, value] of entries) {
        if (value.expires <= now) {
          this.cache.delete(key)
        }
      }

      // Remove oldest entries if cache is too large
      if (this.cache.size > this.config.cache.maxSize) {
        const sortedEntries = entries
          .filter(([, value]) => value.expires > now)
          .sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed)

        const toRemove = sortedEntries.slice(0, this.cache.size - this.config.cache.maxSize)
        for (const [key] of toRemove) {
          this.cache.delete(key)
        }
      }
    }
  }

  /**
   * In-memory storage backend for testing and temporary data
   */
  export class MemoryStorageBackend extends StorageBackend {
    private data = new Map<string, { data: any; metadata: StorageMetadata }>()

    async store(key: string, data: any, _options: StorageOptions = {}): Promise<StorageMetadata> {
      const serialized = JSON.stringify(data)
      const metadata: StorageMetadata = {
        key,
        size: serialized.length,
        compressed: false,
        encrypted: false,
        checksum: this.calculateChecksum(serialized),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
      }

      this.data.set(key, { data, metadata })
      this.log.debug("Data stored in memory", { key, size: metadata.size })
      return metadata
    }

    async retrieve<T = any>(key: string): Promise<T | null> {
      const stored = this.data.get(key)
      if (!stored) return null

      stored.metadata.accessCount++
      stored.metadata.lastAccessed = Date.now()
      this.log.debug("Data retrieved from memory", { key })
      return stored.data as T
    }

    async remove(key: string): Promise<void> {
      this.data.delete(key)
      this.log.debug("Data removed from memory", { key })
    }

    async list(prefix = ""): Promise<string[]> {
      return Array.from(this.data.keys()).filter((key) => key.startsWith(prefix))
    }

    async exists(key: string): Promise<boolean> {
      return this.data.has(key)
    }

    async getMetadata(key: string): Promise<StorageMetadata | null> {
      const stored = this.data.get(key)
      return stored?.metadata || null
    }

    async cleanup(): Promise<{ removedKeys: number; freedSpace: number }> {
      const removedKeys = this.data.size
      let freedSpace = 0

      for (const [, value] of this.data) {
        freedSpace += value.metadata.size
      }

      this.data.clear()
      this.log.info("Memory storage cleared", { removedKeys, freedSpace })
      return { removedKeys, freedSpace }
    }

    private calculateChecksum(data: string): string {
      return createHash("sha256").update(data).digest("hex")
    }
  }

  /**
   * Storage manager that handles backend selection and configuration
   */
  export class StorageManager {
    private backend: StorageBackend
    private config: StorageConfig

    constructor(config?: Partial<StorageConfig>) {
      this.config = StorageConfig.parse(config || {})
      this.backend = this.createBackend()
    }

    private createBackend(): StorageBackend {
      switch (this.config.backend) {
        case "file":
          return new FileStorageBackend(this.config)
        case "memory":
          return new MemoryStorageBackend(this.config)
        case "database":
          // For now, fall back to file storage
          log.warn("Database backend not implemented, using file backend")
          return new FileStorageBackend(this.config)
        default:
          throw new Error(`Unsupported storage backend: ${this.config.backend}`)
      }
    }

    async store(key: string, data: any, options?: StorageOptions): Promise<StorageMetadata> {
      return this.backend.store(key, data, options)
    }

    async retrieve<T = any>(key: string): Promise<T | null> {
      return this.backend.retrieve<T>(key)
    }

    async remove(key: string): Promise<void> {
      return this.backend.remove(key)
    }

    async list(prefix?: string): Promise<string[]> {
      return this.backend.list(prefix)
    }

    async exists(key: string): Promise<boolean> {
      return this.backend.exists(key)
    }

    async getMetadata(key: string): Promise<StorageMetadata | null> {
      return this.backend.getMetadata(key)
    }

    async cleanup(): Promise<{ removedKeys: number; freedSpace: number }> {
      return this.backend.cleanup()
    }

    getConfig(): StorageConfig {
      return { ...this.config }
    }

    async getStatistics(): Promise<{
      backend: string
      totalKeys: number
      totalSize: number
      cacheHitRate?: number
      compressionRatio?: number
    }> {
      try {
        const keys = await this.list()
        let totalSize = 0
        let compressedSize = 0
        let uncompressedCount = 0

        for (const key of keys) {
          const metadata = await this.getMetadata(key)
          if (metadata) {
            totalSize += metadata.size
            if (metadata.compressed) {
              compressedSize += metadata.size
            } else {
              uncompressedCount++
            }
          }
        }

        const stats = {
          backend: this.config.backend,
          totalKeys: keys.length,
          totalSize,
        }

        // Add compression ratio if applicable
        if (compressedSize > 0) {
          const compressionRatio = compressedSize / totalSize
          return { ...stats, compressionRatio }
        }

        return stats
      } catch (error) {
        log.error("Failed to get storage statistics", { error })
        return {
          backend: this.config.backend,
          totalKeys: 0,
          totalSize: 0,
        }
      }
    }
  }

  // Singleton instance
  let instance: StorageManager | null = null

  /**
   * Get the singleton storage manager instance
   */
  export async function getInstance(): Promise<StorageManager> {
    if (!instance) {
      const config = await getStorageConfig()
      instance = new StorageManager(config)
    }
    return instance
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  export function resetInstance(): void {
    instance = null
  }

  /**
   * Get storage configuration from app config
   */
  async function getStorageConfig(): Promise<Partial<StorageConfig>> {
    try {
      const config = await Config.get()
      return {
        backend: (config.experimental?.sessionStorage?.backend as any) || "file",
        compression: {
          enabled: config.experimental?.sessionStorage?.compression?.enabled ?? true,
          algorithm: (config.experimental?.sessionStorage?.compression?.algorithm as any) || "gzip",
          threshold: config.experimental?.sessionStorage?.compression?.threshold ?? 1024,
        },
        encryption: {
          enabled: config.experimental?.sessionStorage?.encryption?.enabled ?? false,
          algorithm: (config.experimental?.sessionStorage?.encryption?.algorithm as any) || "aes-256-gcm",
          keyDerivation: (config.experimental?.sessionStorage?.encryption?.keyDerivation as any) || "pbkdf2",
        },
        cache: {
          enabled: config.experimental?.sessionStorage?.cache?.enabled ?? true,
          maxSize: config.experimental?.sessionStorage?.cache?.maxSize ?? 100,
          ttl: config.experimental?.sessionStorage?.cache?.ttl ?? 5 * 60 * 1000,
        },
      }
    } catch (error) {
      log.warn("Failed to load storage config, using defaults", { error })
      return {}
    }
  }
}

// Export the Storage namespace as the default export for easier importing
export const Storage = SessionStorage
