import * as path from "path";
import { App } from "../app/app";

/**
 * Utility type for deep partial objects
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Configuration management for memory storage system
 */
export interface MemoryConfig {
  database: {
    path?: string;
    enableEncryption: boolean;
    cacheSize: number;
    cacheTTL: number;
    vacuumInterval: number;
    maxConnections: number;
  };
  analytics: {
    retentionDays: number;
    enableTrending: boolean;
    trackEffectiveness: boolean;
    sessionTimeout: number;
  };
  performance: {
    enableQueryCache: boolean;
    maxSearchResults: number;
    paginationSize: number;
    indexOptimization: boolean;
  };
  security: {
    enableAuditLog: boolean;
    sanitizeInputs: boolean;
    requirePermissions: boolean;
    encryptionAlgorithm: string;
  };
}

export class MemoryConfigManager {
  private static config: MemoryConfig | null = null;
  private static configPath: string | null = null;

  /**
   * Load configuration from file or environment
   */
  static async loadConfig(): Promise<MemoryConfig> {
    if (this.config) {
      return this.config;
    }

    // Try to load from config file
    const configFromFile = await this.loadFromFile();

    // Merge with environment variables
    const configFromEnv = this.loadFromEnvironment();

    // Merge with defaults
    this.config = this.mergeConfigs(
      this.getDefaultConfig(),
      configFromFile,
      configFromEnv,
    );

    return this.config;
  }

  /**
   * Get default configuration
   */
  private static getDefaultConfig(): MemoryConfig {
    return {
      database: {
        enableEncryption: false,
        cacheSize: 200,
        cacheTTL: 300000, // 5 minutes
        vacuumInterval: 86400000, // 24 hours
        maxConnections: 1,
      },
      analytics: {
        retentionDays: 90,
        enableTrending: true,
        trackEffectiveness: true,
        sessionTimeout: 1800000, // 30 minutes
      },
      performance: {
        enableQueryCache: true,
        maxSearchResults: 100,
        paginationSize: 20,
        indexOptimization: true,
      },
      security: {
        enableAuditLog: false,
        sanitizeInputs: true,
        requirePermissions: true,
        encryptionAlgorithm: "aes-256-cbc",
      },
    };
  }

  /**
   * Load configuration from file
   */
  private static async loadFromFile(): Promise<Partial<MemoryConfig>> {
    try {
      const configPath = this.getConfigPath();
      const file = Bun.file(configPath);

      if (await file.exists()) {
        const content = await file.text();
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn("Failed to load config file:", error);
    }

    return {};
  }

  /**
   * Load configuration from environment variables
   */
  private static loadFromEnvironment(): DeepPartial<MemoryConfig> {
    const env = process.env;

    return {
      database: {
        path: env.KUUZUKI_DB_PATH,
        enableEncryption: env.KUUZUKI_ENCRYPT_RULES === "true",
        cacheSize: env.KUUZUKI_CACHE_SIZE
          ? parseInt(env.KUUZUKI_CACHE_SIZE)
          : undefined,
        cacheTTL: env.KUUZUKI_CACHE_TTL
          ? parseInt(env.KUUZUKI_CACHE_TTL)
          : undefined,
        vacuumInterval: env.KUUZUKI_VACUUM_INTERVAL
          ? parseInt(env.KUUZUKI_VACUUM_INTERVAL)
          : undefined,
      },
      analytics: {
        retentionDays: env.KUUZUKI_RETENTION_DAYS
          ? parseInt(env.KUUZUKI_RETENTION_DAYS)
          : undefined,
        enableTrending: env.KUUZUKI_ENABLE_TRENDING !== "false",
        trackEffectiveness: env.KUUZUKI_TRACK_EFFECTIVENESS !== "false",
      },
      performance: {
        enableQueryCache: env.KUUZUKI_ENABLE_CACHE !== "false",
        maxSearchResults: env.KUUZUKI_MAX_SEARCH_RESULTS
          ? parseInt(env.KUUZUKI_MAX_SEARCH_RESULTS)
          : undefined,
        paginationSize: env.KUUZUKI_PAGINATION_SIZE
          ? parseInt(env.KUUZUKI_PAGINATION_SIZE)
          : undefined,
      },
      security: {
        enableAuditLog: env.KUUZUKI_ENABLE_AUDIT_LOG === "true",
        sanitizeInputs: env.KUUZUKI_SANITIZE_INPUTS !== "false",
        requirePermissions: env.KUUZUKI_REQUIRE_PERMISSIONS !== "false",
      },
    };
  }

  /**
   * Merge multiple configuration objects
   */
  private static mergeConfigs(
    ...configs: (Partial<MemoryConfig> | DeepPartial<MemoryConfig>)[]
  ): MemoryConfig {
    const result = {} as MemoryConfig;

    for (const config of configs) {
      for (const [section, values] of Object.entries(config)) {
        if (!result[section as keyof MemoryConfig]) {
          result[section as keyof MemoryConfig] = {} as any;
        }

        Object.assign(result[section as keyof MemoryConfig], values);
      }
    }

    return result;
  }

  /**
   * Get configuration file path
   */
  private static getConfigPath(): string {
    if (this.configPath) {
      return this.configPath;
    }

    try {
      const app = App.info();
      this.configPath = path.join(
        app.path.root,
        ".kuuzuki",
        "memory-config.json",
      );
    } catch {
      this.configPath = path.join(
        process.cwd(),
        ".kuuzuki",
        "memory-config.json",
      );
    }

    return this.configPath;
  }

  /**
   * Save configuration to file
   */
  static async saveConfig(config: MemoryConfig): Promise<void> {
    try {
      const configPath = this.getConfigPath();
      const configDir = path.dirname(configPath);

      // Ensure directory exists
      if (!require("fs").existsSync(configDir)) {
        require("fs").mkdirSync(configDir, { recursive: true });
      }

      await Bun.write(configPath, JSON.stringify(config, null, 2));
      this.config = config;
    } catch (error) {
      console.error("Failed to save config:", error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  static getConfig(): MemoryConfig | null {
    return this.config;
  }

  /**
   * Update configuration
   */
  static async updateConfig(
    updates: Partial<MemoryConfig>,
  ): Promise<MemoryConfig> {
    const currentConfig = await this.loadConfig();
    const newConfig = this.mergeConfigs(currentConfig, updates);

    await this.saveConfig(newConfig);
    return newConfig;
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: MemoryConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate database settings
    if (config.database.cacheSize < 10 || config.database.cacheSize > 10000) {
      errors.push("Database cache size must be between 10 and 10000");
    }

    if (config.database.cacheTTL < 1000 || config.database.cacheTTL > 3600000) {
      errors.push("Cache TTL must be between 1 second and 1 hour");
    }

    // Validate analytics settings
    if (
      config.analytics.retentionDays < 1 ||
      config.analytics.retentionDays > 365
    ) {
      errors.push("Retention days must be between 1 and 365");
    }

    // Validate performance settings
    if (
      config.performance.maxSearchResults < 1 ||
      config.performance.maxSearchResults > 1000
    ) {
      errors.push("Max search results must be between 1 and 1000");
    }

    if (
      config.performance.paginationSize < 1 ||
      config.performance.paginationSize > 100
    ) {
      errors.push("Pagination size must be between 1 and 100");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Reset to default configuration
   */
  static async resetToDefaults(): Promise<MemoryConfig> {
    const defaultConfig = this.getDefaultConfig();
    await this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Get configuration summary for display
   */
  static getConfigSummary(): string {
    const config = this.config;
    if (!config) {
      return "Configuration not loaded";
    }

    return `
Memory Storage Configuration:
  Database:
    - Encryption: ${config.database.enableEncryption ? "Enabled" : "Disabled"}
    - Cache Size: ${config.database.cacheSize} entries
    - Cache TTL: ${Math.round(config.database.cacheTTL / 1000)}s
    
  Analytics:
    - Retention: ${config.analytics.retentionDays} days
    - Trending: ${config.analytics.enableTrending ? "Enabled" : "Disabled"}
    - Effectiveness Tracking: ${config.analytics.trackEffectiveness ? "Enabled" : "Disabled"}
    
  Performance:
    - Query Cache: ${config.performance.enableQueryCache ? "Enabled" : "Disabled"}
    - Max Search Results: ${config.performance.maxSearchResults}
    - Pagination Size: ${config.performance.paginationSize}
    
  Security:
    - Audit Log: ${config.security.enableAuditLog ? "Enabled" : "Disabled"}
    - Input Sanitization: ${config.security.sanitizeInputs ? "Enabled" : "Disabled"}
    - Permission Checks: ${config.security.requirePermissions ? "Enabled" : "Disabled"}
    `.trim();
  }
}
