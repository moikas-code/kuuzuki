import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { ConfigSchema } from "../src/config/schema"
import { ConfigMigration } from "../src/config/migration"
import fs from "fs/promises"
import path from "path"
import os from "os"

describe("Configuration System", () => {
  let tempDir: string
  let configPath: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kuuzuki-config-test-"))
    configPath = path.join(tempDir, "kuuzuki.json")
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe("ConfigSchema", () => {
    test("should validate default configuration", () => {
      const defaultConfig = ConfigSchema.getDefaultConfig()
      expect(defaultConfig).toBeDefined()
      expect(defaultConfig.version).toBe(ConfigSchema.CONFIG_VERSION)
      expect(defaultConfig.$schema).toBe(ConfigSchema.SCHEMA_URL)
      expect(defaultConfig.theme).toBe("default")
      expect(defaultConfig.share).toBe("manual")
    })

    test("should validate minimal configuration", () => {
      const minimalConfig = {}
      const validated = ConfigSchema.validateConfig(minimalConfig)

      expect(validated.version).toBe(ConfigSchema.CONFIG_VERSION)
      expect(validated.$schema).toBe(ConfigSchema.SCHEMA_URL)
      expect(validated.theme).toBe("default")
    })

    test("should validate complex configuration", () => {
      const complexConfig = {
        theme: "dark",
        model: "anthropic/claude-3-5-sonnet",
        small_model: "anthropic/claude-3-haiku",
        share: "auto" as const,
        provider: {
          anthropic: {
            name: "anthropic",
            enabled: true,
            options: {
              apiKey: "test-key",
              baseURL: "https://api.anthropic.com",
            },
          },
        },
        mcp: {
          "test-server": {
            type: "local" as const,
            command: ["node", "server.js"],
            enabled: true,
          },
        },
        keybinds: {
          leader: "ctrl+space",
          app_help: "<leader>?",
        },
        experimental: {
          features: {
            hybridContext: true,
          },
        },
      }

      const validated = ConfigSchema.validateConfig(complexConfig)
      expect(validated.theme).toBe("dark")
      expect(validated.model).toBe("anthropic/claude-3-5-sonnet")
      expect(validated.share).toBe("auto")
      expect(validated.provider?.["anthropic"]?.enabled).toBe(true)
      expect(validated.mcp?.["test-server"]?.type).toBe("local")
      expect(validated.keybinds?.leader).toBe("ctrl+space")
      expect(validated.experimental?.features?.hybridContext).toBe(true)
    })

    test("should parse environment variables", () => {
      // Set test environment variables
      process.env["ANTHROPIC_API_KEY"] = "test-anthropic-key"
      process.env["KUUZUKI_MODEL"] = "anthropic/claude-3-opus"
      process.env["KUUZUKI_THEME"] = "custom"

      const envConfig = ConfigSchema.parseEnvironmentVariables()

      expect(envConfig.provider?.["anthropic"]?.options?.apiKey).toBe("test-anthropic-key")
      expect(envConfig.model).toBe("anthropic/claude-3-opus")
      expect(envConfig.theme).toBe("custom")

      // Clean up
      delete process.env["ANTHROPIC_API_KEY"]
      delete process.env["KUUZUKI_MODEL"]
      delete process.env["KUUZUKI_THEME"]
    })

    test("should reject invalid configuration", () => {
      const invalidConfig = {
        share: "invalid-value",
        temperature: -1, // Invalid temperature
        mcp: {
          "invalid-server": {
            type: "invalid-type",
          },
        },
      }

      expect(() => ConfigSchema.validateConfig(invalidConfig)).toThrow()
    })
  })

  describe("ConfigMigration", () => {
    test("should detect migration needs", async () => {
      const legacyConfig = {
        autoshare: true,
        keybinds: {
          messages_revert: "ctrl+z",
        },
      }

      const engine = new ConfigMigration.MigrationEngine(configPath)
      const needsMigration = await engine.needsMigration(legacyConfig)
      expect(needsMigration).toBe(true)
    })

    test("should migrate legacy configuration", async () => {
      const legacyConfig = {
        autoshare: true,
        theme: "dark",
        keybinds: {
          messages_revert: "ctrl+z",
          leader: "ctrl+x",
        },
        provider: {
          anthropic: {
            name: "anthropic",
          },
        },
      }

      const engine = new ConfigMigration.MigrationEngine(configPath)
      const result = await engine.migrate(legacyConfig, { createBackup: false })

      expect(result.config.version).toBe(ConfigSchema.CONFIG_VERSION)
      expect(result.config.share).toBe("auto") // migrated from autoshare: true
      expect(result.config.keybinds?.messages_undo).toBe("ctrl+z") // migrated from messages_revert
      expect(result.config.provider?.["anthropic"]?.enabled).toBe(true) // added default
    })

    test("should not migrate current version", async () => {
      const currentConfig = ConfigSchema.getDefaultConfig()

      const engine = new ConfigMigration.MigrationEngine(configPath)
      const needsMigration = await engine.needsMigration(currentConfig)
      expect(needsMigration).toBe(false)
    })
  })

  describe("BackupManager", () => {
    test("should create and restore backups", async () => {
      const originalConfig = { theme: "original", version: "1.0.0" }
      await fs.writeFile(configPath, JSON.stringify(originalConfig, null, 2))

      const backupManager = new ConfigMigration.BackupManager(configPath)

      // Create backup
      const backupPath = await backupManager.createBackup("-test")
      expect(
        await fs.access(backupPath).then(
          () => true,
          () => false,
        ),
      ).toBe(true)

      // Modify original
      const modifiedConfig = { theme: "modified", version: "1.0.0" }
      await fs.writeFile(configPath, JSON.stringify(modifiedConfig, null, 2))

      // Restore backup
      await backupManager.restoreBackup(backupPath)

      const restoredContent = await fs.readFile(configPath, "utf-8")
      const restoredConfig = JSON.parse(restoredContent)
      expect(restoredConfig.theme).toBe("original")
    })

    test("should list and cleanup backups", async () => {
      await fs.writeFile(configPath, JSON.stringify({ test: true }, null, 2))

      const backupManager = new ConfigMigration.BackupManager(configPath)

      // Create multiple backups
      await backupManager.createBackup("-1")
      await backupManager.createBackup("-2")
      await backupManager.createBackup("-3")

      // List backups
      const backups = await backupManager.listBackups()
      expect(backups.length).toBe(3)

      // Cleanup old backups (keep 2)
      await backupManager.cleanupOldBackups(2)

      const remainingBackups = await backupManager.listBackups()
      expect(remainingBackups.length).toBe(2)
    })
  })

  describe("Integration", () => {
    test("should handle complete configuration lifecycle", async () => {
      // Start with legacy config
      const legacyConfig = {
        autoshare: true,
        theme: "dark",
        model: "anthropic/claude-3-sonnet",
        provider: {
          anthropic: {
            name: "anthropic",
            options: {
              apiKey: "test-key",
            },
          },
        },
      }

      // Write legacy config
      await fs.writeFile(configPath, JSON.stringify(legacyConfig, null, 2))

      // Migrate
      const engine = new ConfigMigration.MigrationEngine(configPath)
      const migrationResult = await engine.migrate(legacyConfig, {
        createBackup: true,
        dryRun: false,
      })

      // Verify migration
      expect(migrationResult.config.version).toBe(ConfigSchema.CONFIG_VERSION)
      expect(migrationResult.config.share).toBe("auto")
      expect(migrationResult.config.theme).toBe("dark")
      expect(migrationResult.config.model).toBe("anthropic/claude-3-sonnet")
      expect(migrationResult.backupPath).toBeDefined()

      // Validate final config
      const validatedConfig = ConfigSchema.validateConfig(migrationResult.config)
      expect(validatedConfig).toBeDefined()
      expect(validatedConfig.$schema).toBe(ConfigSchema.SCHEMA_URL)
    })
  })
})
