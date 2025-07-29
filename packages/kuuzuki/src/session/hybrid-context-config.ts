import { z } from "zod"
import { Log } from "../util/log"

/**
 * Hybrid Context Configuration Schema
 *
 * Provides comprehensive configuration for the hybrid context system
 * with environment variable support and runtime updates
 */
export const HybridContextConfigSchema = z.object({
  enabled: z.boolean().default(true).describe("Enable hybrid context management"),

  tiers: z
    .object({
      recent: z.object({
        maxTokens: z.number().min(1000).default(30000).describe("Maximum tokens for recent messages"),
        compressionThreshold: z.number().min(0).max(1).default(0.65).describe("Start compression at this utilization"),
      }),
      compressed: z.object({
        maxTokens: z.number().min(1000).default(40000).describe("Maximum tokens for compressed messages"),
      }),
      semantic: z.object({
        maxTokens: z.number().min(1000).default(20000).describe("Maximum tokens for semantic facts"),
        maxFactsPerMessage: z.number().min(1).default(5).describe("Maximum facts to extract per message"),
      }),
      pinned: z.object({
        maxTokens: z.number().min(1000).default(15000).describe("Maximum tokens for pinned messages"),
      }),
    })
    .default({
      recent: { maxTokens: 30000, compressionThreshold: 0.65 },
      compressed: { maxTokens: 40000 },
      semantic: { maxTokens: 20000, maxFactsPerMessage: 5 },
      pinned: { maxTokens: 15000 },
    }),

  compression: z
    .object({
      lightThreshold: z.number().min(0).max(1).default(0.65).describe("Trigger light compression"),
      mediumThreshold: z.number().min(0).max(1).default(0.75).describe("Trigger medium compression"),
      heavyThreshold: z.number().min(0).max(1).default(0.85).describe("Trigger heavy compression"),
      emergencyThreshold: z.number().min(0).max(1).default(0.95).describe("Trigger emergency compression"),
      batchSize: z.number().min(1).default(10).describe("Messages to process per compression batch"),
    })
    .default({
      lightThreshold: 0.65,
      mediumThreshold: 0.75,
      heavyThreshold: 0.85,
      emergencyThreshold: 0.95,
      batchSize: 10,
    }),

  performance: z
    .object({
      maxCacheSize: z.number().min(100).default(1000).describe("Maximum messages to cache in memory"),
      compressionDebounceMs: z.number().min(0).default(1000).describe("Debounce compression operations"),
      saveDebounceMs: z.number().min(0).default(500).describe("Debounce save operations"),
    })
    .default({
      maxCacheSize: 1000,
      compressionDebounceMs: 1000,
      saveDebounceMs: 500,
    }),

  extraction: z
    .object({
      minConfidence: z.number().min(0).max(1).default(0.5).describe("Minimum confidence for fact extraction"),
      maxFactsPerType: z.number().min(1).default(20).describe("Maximum facts per type to retain"),
      factExpirationDays: z.number().min(1).default(30).describe("Days before facts expire"),
    })
    .default({
      minConfidence: 0.5,
      maxFactsPerType: 20,
      factExpirationDays: 30,
    }),
})

export type HybridContextConfig = z.infer<typeof HybridContextConfigSchema>

/**
 * Configuration manager for hybrid context
 */
export namespace HybridContextConfig {
  let currentConfig: HybridContextConfig | null = null

  /**
   * Load configuration from environment and flags
   */
  export function load(): HybridContextConfig {
    if (currentConfig) return currentConfig

    const config: Partial<HybridContextConfig> = {}

    // Check if hybrid context is enabled via environment variable
    const enabledValue = process.env["KUUZUKI_HYBRID_CONTEXT_ENABLED"]?.toLowerCase()
    if (enabledValue === "true" || enabledValue === "1") {
      config.enabled = true
    } else if (enabledValue === "false" || enabledValue === "0") {
      config.enabled = false
    }
    // If not set, the schema default (true) will be used

    // Load tier configurations from environment
    const envPrefix = "HYBRID_CONTEXT_"

    // Recent tier
    const recentMaxTokens = process.env[`${envPrefix}RECENT_MAX_TOKENS`]
    if (recentMaxTokens) {
      if (!config.tiers) {
        config.tiers = {} as any
      }
      if (!config.tiers!.recent) {
        config.tiers!.recent = {} as any
      }
      config.tiers!.recent.maxTokens = parseInt(recentMaxTokens)
    }

    // Compression thresholds
    const lightThreshold = process.env[`${envPrefix}LIGHT_THRESHOLD`]
    if (lightThreshold) {
      if (!config.compression) config.compression = {} as any
      config.compression!.lightThreshold = parseFloat(lightThreshold)
    }

    const mediumThreshold = process.env[`${envPrefix}MEDIUM_THRESHOLD`]
    if (mediumThreshold) {
      if (!config.compression) config.compression = {} as any
      config.compression!.mediumThreshold = parseFloat(mediumThreshold)
    }

    const heavyThreshold = process.env[`${envPrefix}HEAVY_THRESHOLD`]
    if (heavyThreshold) {
      if (!config.compression) config.compression = {} as any
      config.compression!.heavyThreshold = parseFloat(heavyThreshold)
    }

    const emergencyThreshold = process.env[`${envPrefix}EMERGENCY_THRESHOLD`]
    if (emergencyThreshold) {
      if (!config.compression) config.compression = {} as any
      config.compression!.emergencyThreshold = parseFloat(emergencyThreshold)
    }

    // Performance settings
    const maxCacheSize = process.env[`${envPrefix}MAX_CACHE_SIZE`]
    if (maxCacheSize) {
      if (!config.performance) config.performance = {} as any
      config.performance!.maxCacheSize = parseInt(maxCacheSize)
    }

    // Parse and validate the complete config
    currentConfig = HybridContextConfigSchema.parse(config)
    return currentConfig
  }

  /**
   * Update configuration at runtime
   */
  export function update(updates: Partial<HybridContextConfig>): HybridContextConfig {
    const current = load()
    const merged = { ...current, ...updates }
    currentConfig = HybridContextConfigSchema.parse(merged)
    return currentConfig
  }

  /**
   * Reset configuration to defaults
   */
  export function reset(): HybridContextConfig {
    currentConfig = null
    return load()
  }

  /**
   * Get specific configuration value
   */
  export function get<K extends keyof HybridContextConfig>(key: K): HybridContextConfig[K] {
    return load()[key]
  }

  /**
   * Check if hybrid context is enabled
   */
  export function isEnabled(): boolean {
    // Check for force-disable flag first
    if (process.env["KUUZUKI_HYBRID_CONTEXT_FORCE_DISABLE"] === "true") {
      Log.create({ service: "hybrid-context-config" }).warn("Hybrid context force disabled via environment")
      return false
    }

    return load().enabled
  }

  /**
   * Get compression threshold for a specific level
   */
  export function getCompressionThreshold(level: "light" | "medium" | "heavy" | "emergency"): number {
    const config = load()
    return config.compression[`${level}Threshold`]
  }

  /**
   * Get tier configuration
   */
  export function getTierConfig(tier: "recent" | "compressed" | "semantic" | "pinned") {
    return load().tiers[tier]
  }
}
