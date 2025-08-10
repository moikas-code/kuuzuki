import path from "path";
import { homedir } from "os";
import { promises as fs } from "fs";
import { Global } from "../global";
import { safeJsonParse } from "../util/json-utils";
import { UnifiedAuth } from "./unified-auth";
import { Log } from "../util/log";

const log = Log.create({ service: "auth-migration" });

export namespace AuthMigration {
  export interface LegacyAuthData {
    apiKey: string;
    email: string;
    savedAt: number;
    environment: "live" | "test";
  }

  export interface MainAuthData {
    [providerID: string]: {
      type: "oauth" | "api" | "wellknown";
      refresh?: string;
      access?: string;
      expires?: number;
      key?: string;
      token?: string;
    };
  }

  export interface MigrationResult {
    success: boolean;
    migratedCredentials: string[];
    errors: string[];
    backupPath?: string;
  }

  const LEGACY_AUTH_PATH = path.join(homedir(), ".kuuzuki", "auth.json");
  const MAIN_AUTH_PATH = path.join(Global.Path.data, "auth.json");
  const BACKUP_DIR = path.join(Global.Path.data, "backups");

  /**
   * Check if migration is needed by detecting legacy credentials
   */
  export async function needsMigration(): Promise<boolean> {
    try {
      // Check if legacy auth file exists
      await fs.access(LEGACY_AUTH_PATH);
      return true;
    } catch {
      // No legacy file found
      return false;
    }
  }

  /**
   * Create backup of existing auth files before migration
   */
  export async function createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `auth-backup-${timestamp}`);
    
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    await fs.mkdir(backupPath, { recursive: true });

    // Backup legacy auth if exists
    try {
      await fs.access(LEGACY_AUTH_PATH);
      await fs.copyFile(
        LEGACY_AUTH_PATH,
        path.join(backupPath, "legacy-auth.json")
      );
      log.debug("Backed up legacy auth file", { backupPath });
    } catch {
      // Legacy file doesn't exist, skip
    }

    // Backup main auth if exists
    try {
      await fs.access(MAIN_AUTH_PATH);
      await fs.copyFile(
        MAIN_AUTH_PATH,
        path.join(backupPath, "main-auth.json")
      );
      log.debug("Backed up main auth file", { backupPath });
    } catch {
      // Main file doesn't exist, skip
    }

    return backupPath;
  }

  /**
   * Load legacy auth data from ~/.kuuzuki/auth.json
   */
  export async function loadLegacyAuth(): Promise<LegacyAuthData | null> {
    try {
      const content = await fs.readFile(LEGACY_AUTH_PATH, "utf-8");
      const data = safeJsonParse(content, "legacy auth");
      
      if (!data || typeof data !== "object") {
        return null;
      }

      // Validate legacy auth structure
      if (
        typeof (data as any).apiKey === "string" &&
        typeof (data as any).email === "string" &&
        typeof (data as any).savedAt === "number" &&
        ((data as any).environment === "live" || (data as any).environment === "test")
      ) {
        return data as LegacyAuthData;
      }

      log.warn("Invalid legacy auth data structure", { data });
      return null;
    } catch (error) {
      log.debug("Failed to load legacy auth", { error });
      return null;
    }
  }

  /**
   * Load main auth data from XDG data directory
   */
  export async function loadMainAuth(): Promise<MainAuthData | null> {
    try {
      const content = await fs.readFile(MAIN_AUTH_PATH, "utf-8");
      const data = safeJsonParse(content, "main auth");
      
      if (!data || typeof data !== "object") {
        return null;
      }

      return data as MainAuthData;
    } catch (error) {
      log.debug("Failed to load main auth", { error });
      return null;
    }
  }

  /**
   * Convert legacy API key data to unified auth format
   */
  export function convertLegacyToUnified(legacy: LegacyAuthData): UnifiedAuth.Credential {
    return {
      type: "api" as const,
      key: legacy.apiKey,
      createdAt: legacy.savedAt,
      source: "manual" as const
    };
  }

  /**
   * Convert main auth data to unified auth format
   */
  export function convertMainToUnified(
    mainAuth: MainAuthData[string]
  ): UnifiedAuth.Credential {
    switch (mainAuth.type) {
      case "oauth":
        return {
          type: "oauth",
          refresh: mainAuth.refresh!,
          access: mainAuth.access!,
          expires: mainAuth.expires!
        };

      case "api":
        return {
          type: "api",
          key: mainAuth.key!,
          source: "manual" as const
        };

      case "wellknown":
        return {
          type: "wellknown",
          key: mainAuth.key!,
          token: mainAuth.token!
        };

      default:
        throw new Error(`Unknown auth type: ${(mainAuth as any).type}`);
    }
  }

  /**
   * Resolve conflicts when both systems have credentials for same provider
   */
  export function resolveConflict(
    providerID: string,
    legacy: UnifiedAuth.Credential,
    main: UnifiedAuth.Credential
  ): UnifiedAuth.Credential {
    log.warn("Auth conflict detected, preferring main auth", { 
      providerID, 
      legacyType: legacy.type, 
      mainType: main.type 
    });

    // Prefer main auth system credentials
    return main;
  }

  /**
   * Perform complete migration from both legacy and main auth systems
   */
  export async function migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedCredentials: [],
      errors: []
    };

    try {
      log.info("Starting authentication migration");

      // Create backup first
      result.backupPath = await createBackup();
      log.info("Created auth backup", { backupPath: result.backupPath });

      // Load existing auth data
      const legacyAuth = await loadLegacyAuth();
      const mainAuth = await loadMainAuth();

      if (!legacyAuth && !mainAuth) {
        log.info("No existing auth data found, migration not needed");
        result.success = true;
        return result;
      }

      // Initialize unified auth system

      // Migrate legacy API key if exists
      if (legacyAuth) {
        try {
          const credential = convertLegacyToUnified(legacyAuth);
          await UnifiedAuth.set("kuuzuki-api", credential);
          result.migratedCredentials.push("kuuzuki-api (legacy)");
          log.info("Migrated legacy API key", { environment: legacyAuth.environment });
        } catch (error) {
          const errorMsg = `Failed to migrate legacy API key: ${error}`;
          result.errors.push(errorMsg);
          log.error(errorMsg, { error });
        }
      }

      // Migrate main auth credentials if exist
      if (mainAuth) {
        for (const [providerID, authData] of Object.entries(mainAuth)) {
          try {
            const credential = convertMainToUnified(authData);
            
            // Check for conflicts with legacy migration
            const existing = await UnifiedAuth.get(providerID);
            if (existing) {
              const resolved = resolveConflict(providerID, existing, credential);
              await UnifiedAuth.set(providerID, resolved);
              result.migratedCredentials.push(`${providerID} (conflict resolved)`);
            } else {
              await UnifiedAuth.set(providerID, credential);
              result.migratedCredentials.push(`${providerID} (main)`);
            }
            
            log.info("Migrated main auth credential", { providerID, type: authData.type });
          } catch (error) {
            const errorMsg = `Failed to migrate ${providerID}: ${error}`;
            result.errors.push(errorMsg);
            log.error(errorMsg, { error, providerID });
          }
        }
      }

      // Clean up old auth files after successful migration
      if (result.errors.length === 0) {
        await cleanupOldAuthFiles();
        log.info("Cleaned up old auth files");
      }

      result.success = result.errors.length === 0;
      log.info("Migration completed", { 
        success: result.success, 
        migratedCount: result.migratedCredentials.length,
        errorCount: result.errors.length 
      });

      return result;
    } catch (error) {
      const errorMsg = `Migration failed: ${error}`;
      result.errors.push(errorMsg);
      log.error(errorMsg, { error });
      return result;
    }
  }

  /**
   * Clean up old auth files after successful migration
   */
  async function cleanupOldAuthFiles(): Promise<void> {
    try {
      // Remove legacy auth file
      await fs.unlink(LEGACY_AUTH_PATH).catch(() => {});
      
      // Remove legacy directory if empty
      try {
        await fs.rmdir(path.dirname(LEGACY_AUTH_PATH));
      } catch {
        // Directory not empty or doesn't exist, ignore
      }

      // Remove old main auth file
      await fs.unlink(MAIN_AUTH_PATH).catch(() => {});
      
      log.debug("Cleaned up old auth files");
    } catch (error) {
      log.warn("Failed to cleanup old auth files", { error });
    }
  }

  /**
   * Rollback migration using backup
   */
  export async function rollback(backupPath: string): Promise<boolean> {
    try {
      log.info("Rolling back migration", { backupPath });

      // Restore legacy auth if backup exists
      const legacyBackup = path.join(backupPath, "legacy-auth.json");
      try {
        await fs.access(legacyBackup);
        await fs.mkdir(path.dirname(LEGACY_AUTH_PATH), { recursive: true });
        await fs.copyFile(legacyBackup, LEGACY_AUTH_PATH);
        log.debug("Restored legacy auth file");
      } catch {
        // No legacy backup, skip
      }

      // Restore main auth if backup exists
      const mainBackup = path.join(backupPath, "main-auth.json");
      try {
        await fs.access(mainBackup);
        await fs.mkdir(path.dirname(MAIN_AUTH_PATH), { recursive: true });
        await fs.copyFile(mainBackup, MAIN_AUTH_PATH);
        log.debug("Restored main auth file");
      } catch {
        // No main backup, skip
      }

      // Remove unified auth file
      const unifiedPath = path.join(Global.Path.data, "unified-auth.json");
      await fs.unlink(unifiedPath).catch(() => {});

      log.info("Migration rollback completed");
      return true;
    } catch (error) {
      log.error("Migration rollback failed", { error, backupPath });
      return false;
    }
  }

  /**
   * Validate migration was successful
   */
  export async function validateMigration(): Promise<boolean> {
    try {
      const credentials = await UnifiedAuth.all();
      
      // Check if we have any credentials
      if (Object.keys(credentials).length === 0) {
        log.warn("No credentials found after migration");
        return false;
      }

      // Validate each credential can be loaded
      for (const [providerID] of Object.entries(credentials)) {
        const loaded = await UnifiedAuth.get(providerID);
        if (!loaded) {
          log.error("Failed to load migrated credential", { providerID });
          return false;
        }
      }

      log.info("Migration validation successful", { 
        credentialCount: Object.keys(credentials).length 
      });
      return true;
    } catch (error) {
      log.error("Migration validation failed", { error });
      return false;
    }
  }
}