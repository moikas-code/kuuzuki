import { ConfigSchema } from "./schema"
import { Log } from "../util/log"
import fs from "fs/promises"
import path from "path"

export namespace ConfigMigration {
  const log = Log.create({ service: "config-migration" })

  // Migration interface
  export interface Migration {
    fromVersion: string
    toVersion: string
    description: string
    migrate: (config: any) => Promise<any>
    rollback?: (config: any) => Promise<any>
    validate?: (config: any) => boolean
  }

  // Version comparison utility
  function compareVersions(a: string, b: string): number {
    const aParts = a.split(".").map(Number)
    const bParts = b.split(".").map(Number)

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0
      const bPart = bParts[i] || 0

      if (aPart < bPart) return -1
      if (aPart > bPart) return 1
    }

    return 0
  }

  // Migration registry
  const migrations: Migration[] = [
    {
      fromVersion: "0.0.0",
      toVersion: "1.0.0",
      description: "Initial migration to structured configuration",
      migrate: async (config: any) => {
        log.info("Migrating from legacy configuration to v1.0.0")

        const migrated: any = {
          $schema: ConfigSchema.SCHEMA_URL,
          version: "1.0.0",
        }

        // Migrate autoshare to share field
        if (config.autoshare === true) {
          migrated.share = "auto"
        } else if (config.autoshare === false) {
          migrated.share = "manual"
        }

        // Migrate deprecated keybind
        if (config.keybinds?.messages_revert && !config.keybinds.messages_undo) {
          if (!migrated.keybinds) {
            migrated.keybinds = Object.assign({}, config.keybinds)
          }
          migrated.keybinds.messages_undo = config.keybinds.messages_revert
          delete migrated.keybinds.messages_revert
        }

        // Migrate provider configurations
        if (config.provider) {
          migrated.provider = {}
          for (const [key, value] of Object.entries(config.provider)) {
            migrated.provider[key] = Object.assign({}, value as any, {
              enabled: true,
              priority: 50,
            })
          }
        }

        // Migrate MCP configurations
        if (config.mcp) {
          migrated.mcp = {}
          for (const [key, value] of Object.entries(config.mcp)) {
            const mcpConfig = value as any
            migrated.mcp[key] = Object.assign({}, mcpConfig, {
              enabled: mcpConfig.enabled ?? true,
              timeout: mcpConfig.timeout ?? 30000,
              retries: mcpConfig.retries ?? 3,
            })
          }
        }

        // Copy other fields (excluding keybinds which we handle separately)
        const fieldsToMigrate = [
          "theme",
          "username",
          "model",
          "small_model",
          "apiUrl",
          "subscriptionRequired",
          "autoupdate",
          "disabled_providers",
          "layout",
          "mode",
          "agent",
          "instructions",
          "experimental",
        ]

        for (const field of fieldsToMigrate) {
          if (config[field] !== undefined) {
            migrated[field] = config[field]
          }
        }

        // Handle keybinds separately to preserve migrations
        if (config.keybinds && !migrated.keybinds) {
          migrated.keybinds = Object.assign({}, config.keybinds)
        }

        return migrated
      },
      rollback: async (config: any) => {
        log.info("Rolling back from v1.0.0 to legacy configuration")

        const rolledBack: any = Object.assign({}, config)

        // Rollback share to autoshare
        if (config.share === "auto") {
          rolledBack.autoshare = true
        } else if (config.share === "manual" || config.share === "disabled") {
          rolledBack.autoshare = false
        }
        delete rolledBack.share

        // Remove version and schema
        delete rolledBack.version
        delete rolledBack.$schema

        return rolledBack
      },
      validate: (config: any) => {
        return config.version === "1.0.0" && config.$schema === ConfigSchema.SCHEMA_URL
      },
    },
  ]

  // Backup management
  export class BackupManager {
    constructor(private configPath: string) {}

    async createBackup(suffix = ""): Promise<string> {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const backupPath = `${this.configPath}.backup-${timestamp}${suffix}`

      try {
        await fs.copyFile(this.configPath, backupPath)
        log.info("Created configuration backup", { backupPath })
        return backupPath
      } catch (error) {
        throw new ConfigSchema.BackupError(
          {
            path: this.configPath,
            operation: "create",
            reason: error instanceof Error ? error.message : "Unknown error",
          },
          { cause: error as Error },
        )
      }
    }

    async restoreBackup(backupPath: string): Promise<void> {
      try {
        await fs.copyFile(backupPath, this.configPath)
        log.info("Restored configuration from backup", { backupPath })
      } catch (error) {
        throw new ConfigSchema.BackupError(
          {
            path: backupPath,
            operation: "restore",
            reason: error instanceof Error ? error.message : "Unknown error",
          },
          { cause: error as Error },
        )
      }
    }

    async listBackups(): Promise<string[]> {
      try {
        const dir = path.dirname(this.configPath)
        const basename = path.basename(this.configPath)
        const files = await fs.readdir(dir)

        return files
          .filter((file) => file.startsWith(`${basename}.backup-`))
          .map((file) => path.join(dir, file))
          .sort()
          .reverse() // Most recent first
      } catch (error) {
        log.warn("Failed to list backups", { error })
        return []
      }
    }

    async cleanupOldBackups(keepCount = 5): Promise<void> {
      try {
        const backups = await this.listBackups()
        const toDelete = backups.slice(keepCount)

        for (const backup of toDelete) {
          await fs.unlink(backup)
          log.info("Cleaned up old backup", { backup })
        }
      } catch (error) {
        throw new ConfigSchema.BackupError(
          {
            path: this.configPath,
            operation: "cleanup",
            reason: error instanceof Error ? error.message : "Unknown error",
          },
          { cause: error as Error },
        )
      }
    }
  }

  // Migration engine
  export class MigrationEngine {
    constructor(private configPath: string) {}

    async getCurrentVersion(config: any): Promise<string> {
      // If no version field, assume legacy (0.0.0)
      return config.version || "0.0.0"
    }

    async getTargetVersion(): Promise<string> {
      return ConfigSchema.CONFIG_VERSION
    }

    async needsMigration(config: any): Promise<boolean> {
      const currentVersion = await this.getCurrentVersion(config)
      const targetVersion = await this.getTargetVersion()
      return compareVersions(currentVersion, targetVersion) < 0
    }

    async getMigrationPath(fromVersion: string, toVersion: string): Promise<Migration[]> {
      const path: Migration[] = []
      let currentVersion = fromVersion

      while (compareVersions(currentVersion, toVersion) < 0) {
        const migration = migrations.find(
          (m) =>
            compareVersions(m.fromVersion, currentVersion) <= 0 && compareVersions(currentVersion, m.toVersion) < 0,
        )

        if (!migration) {
          throw new ConfigSchema.MigrationError({
            fromVersion: currentVersion,
            toVersion,
            path: this.configPath,
            reason: `No migration path found from ${currentVersion} to ${toVersion}`,
          })
        }

        path.push(migration)
        currentVersion = migration.toVersion
      }

      return path
    }

    async migrate(
      config: any,
      options: {
        createBackup?: boolean
        dryRun?: boolean
        force?: boolean
      } = {},
    ): Promise<{ config: any; backupPath?: string }> {
      const { createBackup = true, dryRun = false, force = false } = options

      const currentVersion = await this.getCurrentVersion(config)
      const targetVersion = await this.getTargetVersion()

      if (compareVersions(currentVersion, targetVersion) === 0) {
        log.info("Configuration is already up to date", { version: currentVersion })
        return { config }
      }

      if (compareVersions(currentVersion, targetVersion) > 0 && !force) {
        throw new ConfigSchema.MigrationError({
          fromVersion: currentVersion,
          toVersion: targetVersion,
          path: this.configPath,
          reason: "Configuration version is newer than supported version. Use --force to downgrade.",
        })
      }

      const migrationPath = await this.getMigrationPath(currentVersion, targetVersion)
      log.info("Planning migration", {
        from: currentVersion,
        to: targetVersion,
        steps: migrationPath.length,
      })

      let backupPath: string | undefined
      if (createBackup && !dryRun) {
        const backupManager = new BackupManager(this.configPath)
        backupPath = await backupManager.createBackup("-pre-migration")
      }

      let migratedConfig = Object.assign({}, config)

      try {
        for (const migration of migrationPath) {
          log.info("Applying migration", {
            from: migration.fromVersion,
            to: migration.toVersion,
            description: migration.description,
          })

          if (dryRun) {
            log.info("Dry run: would apply migration", { migration: migration.description })
            continue
          }

          migratedConfig = await migration.migrate(migratedConfig)

          // Validate migration result if validator exists
          if (migration.validate && !migration.validate(migratedConfig)) {
            throw new Error(`Migration validation failed: ${migration.description}`)
          }
        }

        // Final validation with schema
        if (!dryRun) {
          ConfigSchema.validateConfig(migratedConfig, this.configPath)
        }

        log.info("Migration completed successfully", {
          from: currentVersion,
          to: targetVersion,
        })

        return { config: migratedConfig, backupPath }
      } catch (error) {
        log.error("Migration failed", { error })

        // Attempt rollback if backup exists
        if (backupPath && !dryRun) {
          try {
            const backupManager = new BackupManager(this.configPath)
            await backupManager.restoreBackup(backupPath)
            log.info("Restored configuration from backup after migration failure")
          } catch (rollbackError) {
            log.error("Failed to restore backup after migration failure", { rollbackError })
          }
        }

        throw new ConfigSchema.MigrationError(
          {
            fromVersion: currentVersion,
            toVersion: targetVersion,
            path: this.configPath,
            reason: error instanceof Error ? error.message : "Unknown migration error",
          },
          { cause: error as Error },
        )
      }
    }

    async rollback(
      config: any,
      targetVersion: string,
      options: {
        createBackup?: boolean
        dryRun?: boolean
      } = {},
    ): Promise<{ config: any; backupPath?: string }> {
      const { createBackup = true, dryRun = false } = options

      const currentVersion = await this.getCurrentVersion(config)

      if (compareVersions(currentVersion, targetVersion) <= 0) {
        throw new ConfigSchema.MigrationError({
          fromVersion: currentVersion,
          toVersion: targetVersion,
          path: this.configPath,
          reason: "Cannot rollback to same or newer version",
        })
      }

      // Find rollback path (reverse of migration path)
      const migrationPath = await this.getMigrationPath(targetVersion, currentVersion)
      const rollbackPath = migrationPath.reverse()

      let backupPath: string | undefined
      if (createBackup && !dryRun) {
        const backupManager = new BackupManager(this.configPath)
        backupPath = await backupManager.createBackup("-pre-rollback")
      }

      let rolledBackConfig = Object.assign({}, config)

      try {
        for (const migration of rollbackPath) {
          if (!migration.rollback) {
            throw new Error(`Migration ${migration.description} does not support rollback`)
          }

          log.info("Rolling back migration", {
            from: migration.toVersion,
            to: migration.fromVersion,
            description: migration.description,
          })

          if (dryRun) {
            log.info("Dry run: would rollback migration", { migration: migration.description })
            continue
          }

          rolledBackConfig = await migration.rollback(rolledBackConfig)
        }

        log.info("Rollback completed successfully", {
          from: currentVersion,
          to: targetVersion,
        })

        return { config: rolledBackConfig, backupPath }
      } catch (error) {
        log.error("Rollback failed", { error })

        if (backupPath && !dryRun) {
          try {
            const backupManager = new BackupManager(this.configPath)
            await backupManager.restoreBackup(backupPath)
            log.info("Restored configuration from backup after rollback failure")
          } catch (restoreError) {
            log.error("Failed to restore backup after rollback failure", { restoreError })
          }
        }

        throw new ConfigSchema.MigrationError(
          {
            fromVersion: currentVersion,
            toVersion: targetVersion,
            path: this.configPath,
            reason: error instanceof Error ? error.message : "Unknown rollback error",
          },
          { cause: error as Error },
        )
      }
    }
  }

  // Utility functions
  export async function migrateConfig(
    configPath: string,
    config: any,
    options?: {
      createBackup?: boolean
      dryRun?: boolean
      force?: boolean
    },
  ): Promise<{ config: any; backupPath?: string }> {
    const engine = new MigrationEngine(configPath)
    return engine.migrate(config, options)
  }

  export async function rollbackConfig(
    configPath: string,
    config: any,
    targetVersion: string,
    options?: {
      createBackup?: boolean
      dryRun?: boolean
    },
  ): Promise<{ config: any; backupPath?: string }> {
    const engine = new MigrationEngine(configPath)
    return engine.rollback(config, targetVersion, options)
  }

  export async function needsMigration(config: any): Promise<boolean> {
    const engine = new MigrationEngine("")
    return engine.needsMigration(config)
  }

  export function addMigration(migration: Migration): void {
    // Insert migration in correct order
    const index = migrations.findIndex((m) => compareVersions(migration.fromVersion, m.fromVersion) < 0)

    if (index === -1) {
      migrations.push(migration)
    } else {
      migrations.splice(index, 0, migration)
    }

    log.info("Added migration", {
      from: migration.fromVersion,
      to: migration.toVersion,
      description: migration.description,
    })
  }

  export function getMigrations(): readonly Migration[] {
    return migrations
  }
}
