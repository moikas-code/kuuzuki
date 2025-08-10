import path from "path";
import { Global } from "../global";
import fs from "fs/promises";
import { z } from "zod";
import { homedir } from "os";
import { Log } from "../util/log";

const log = Log.create({ service: "unified-auth" });

export namespace UnifiedAuth {
  // Unified credential types
  export const OAuthCredential = z.object({
    type: z.literal("oauth"),
    refresh: z.string(),
    access: z.string(),
    expires: z.number(),
  });

  export const ApiCredential = z.object({
    type: z.literal("api"),
    key: z.string(),
    createdAt: z.number().optional(),
    source: z.enum(["manual", "oauth", "console"]).optional(),
  });

  export const WellKnownCredential = z.object({
    type: z.literal("wellknown"),
    key: z.string(),
    token: z.string(),
  });

  export const Credential = z.discriminatedUnion("type", [
    OAuthCredential,
    ApiCredential,
    WellKnownCredential,
  ]);

  export type Credential = z.infer<typeof Credential>;

  // Storage configuration
  const MAIN_AUTH_PATH = path.join(Global.Path.data, "auth.json");

  const LEGACY_APIKEYS_PATH = path.join(homedir(), ".kuuzuki", "apikeys.json");

  /**
   * Get credential for a specific provider
   */
  export async function get(providerID: string): Promise<Credential | undefined> {
    const credentials = await all();
    return credentials[providerID];
  }

  /**
   * Get all credentials
   */
  export async function all(): Promise<Record<string, Credential>> {
    // Try main location first
    try {
      const file = Bun.file(MAIN_AUTH_PATH);
      const data = await file.json();
      log.debug("Loaded credentials from main location", { path: MAIN_AUTH_PATH });
      return data;
    } catch (error) {
      log.debug("No credentials found in main location, checking legacy locations");
    }

    // Migrate from legacy locations if needed
    const migrated = await migrateLegacyCredentials();
    if (Object.keys(migrated).length > 0) {
      log.info("Migrated credentials from legacy locations", { 
        count: Object.keys(migrated).length 
      });
      return migrated;
    }

    return {};
  }

  /**
   * Set credential for a provider
   */
  export async function set(providerID: string, credential: Credential): Promise<void> {
    const credentials = await all();
    credentials[providerID] = credential;
    
    await ensureDataDirectory();
    const file = Bun.file(MAIN_AUTH_PATH);
    await Bun.write(file, JSON.stringify(credentials, null, 2));
    await fs.chmod(MAIN_AUTH_PATH, 0o600);
    
    log.info("Credential saved", { providerID, type: credential.type });
  }

  /**
   * Remove credential for a provider
   */
  export async function remove(providerID: string): Promise<void> {
    const credentials = await all();
    delete credentials[providerID];
    
    const file = Bun.file(MAIN_AUTH_PATH);
    await Bun.write(file, JSON.stringify(credentials, null, 2));
    await fs.chmod(MAIN_AUTH_PATH, 0o600);
    
    log.info("Credential removed", { providerID });
  }

  /**
   * Check if a provider has valid credentials
   */
  export async function hasValidCredentials(providerID: string): Promise<boolean> {
    const credential = await get(providerID);
    if (!credential) return false;

    // Check OAuth token expiry
    if (credential.type === "oauth") {
      return credential.expires > Date.now();
    }

    // API keys and wellknown tokens are considered valid if they exist
    return true;
  }

  /**
   * Migrate credentials from legacy locations
   */
  async function migrateLegacyCredentials(): Promise<Record<string, Credential>> {
    const migrated: Record<string, Credential> = {};

    // Note: Legacy auth.json migration is handled by AuthMigration.migrate()
    // The legacy auth.json has a different structure and should not be processed here

    // Migrate from legacy apikeys.json (API keys)
    try {
      const apiKeysFile = Bun.file(LEGACY_APIKEYS_PATH);
      const apiKeysData = await apiKeysFile.json();
      
      for (const [providerID, data] of Object.entries(apiKeysData)) {
        // Don't overwrite OAuth credentials with API keys
        if (migrated[providerID]?.type === "oauth") {
          log.debug("Skipping API key migration - OAuth credential exists", { providerID });
          continue;
        }

        try {
          const apiData = data as any;
          const credential: Credential = {
            type: "api",
            key: apiData.key,
            createdAt: apiData.createdAt,
            source: apiData.source || "manual",
          };
          
          migrated[providerID] = credential;
          log.debug("Migrated API key from legacy apikeys.json", { providerID });
        } catch (error) {
          log.warn("Failed to migrate API key from legacy apikeys.json", { 
            providerID, 
            error: error.message 
          });
        }
      }
    } catch (error) {
      log.debug("No legacy apikeys.json found");
    }

    // Save migrated credentials if any were found
    if (Object.keys(migrated).length > 0) {
      await ensureDataDirectory();
      const file = Bun.file(MAIN_AUTH_PATH);
      await Bun.write(file, JSON.stringify(migrated, null, 2));
      await fs.chmod(MAIN_AUTH_PATH, 0o600);
      
      log.info("Migration completed", { 
        migratedCount: Object.keys(migrated).length,
        providers: Object.keys(migrated)
      });
    }

    return migrated;
  }

  /**
   * Ensure data directory exists
   */
  async function ensureDataDirectory(): Promise<void> {
    await fs.mkdir(Global.Path.data, { recursive: true });
  }

  /**
   * Get authentication status for all providers
   */
  export async function getStatus(): Promise<Record<string, {
    hasCredentials: boolean;
    type?: string;
    isValid: boolean;
    expiresAt?: number;
  }>> {
    const credentials = await all();
    const status: Record<string, any> = {};

    for (const [providerID, credential] of Object.entries(credentials)) {
      const isValid = await hasValidCredentials(providerID);
      
      status[providerID] = {
        hasCredentials: true,
        type: credential.type,
        isValid,
        ...(credential.type === "oauth" && { expiresAt: credential.expires }),
      };
    }

    return status;
  }

  /**
   * Clean up expired credentials
   */
  export async function cleanupExpired(): Promise<string[]> {
    const credentials = await all();
    const expired: string[] = [];
    let hasChanges = false;

    for (const [providerID, credential] of Object.entries(credentials)) {
      if (credential.type === "oauth" && credential.expires <= Date.now()) {
        delete credentials[providerID];
        expired.push(providerID);
        hasChanges = true;
        log.info("Removed expired OAuth credential", { providerID });
      }
    }

    if (hasChanges) {
      const file = Bun.file(MAIN_AUTH_PATH);
      await Bun.write(file, JSON.stringify(credentials, null, 2));
      await fs.chmod(MAIN_AUTH_PATH, 0o600);
    }

    return expired;
  }
}