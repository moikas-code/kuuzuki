import { UnifiedAuth } from "./unified-auth";
import { AuthMigration } from "./migration";
import { Log } from "../util/log";

const log = Log.create({ service: "auth-storage" });

export interface AuthData {
  apiKey: string
  email: string
  savedAt: number
  environment: "live" | "test"
}

// Migration check flag to avoid repeated checks
let migrationChecked = false;

/**
 * Ensure migration has been performed before any auth operations
 */
async function ensureMigration(): Promise<void> {
  if (migrationChecked) return;
  
  try {
    if (await AuthMigration.needsMigration()) {
      log.info("Legacy credentials detected, performing migration");
      const result = await AuthMigration.migrate();
      
      if (result.success) {
        log.info("Auth migration completed successfully", {
          migratedCount: result.migratedCredentials.length
        });
      } else {
        log.warn("Auth migration completed with errors", {
          errors: result.errors
        });
      }
    }
  } catch (error) {
    log.error("Auth migration failed", { error });
  } finally {
    migrationChecked = true;
  }
}

export async function ensureAuthDir(): Promise<void> {
  // No longer needed - unified auth handles directory creation
  await ensureMigration();
}

export async function saveAuth(data: AuthData): Promise<void> {
  await ensureMigration();
  
  // Convert legacy AuthData to unified credential format
  const credential: UnifiedAuth.Credential = {
    type: "api",
    key: data.apiKey,
    createdAt: data.savedAt,
    source: "manual" as const
  };
  
  // Store in unified auth system with metadata preserved in a separate way
  await UnifiedAuth.set("kuuzuki-api", credential);
  
  // Store additional metadata if needed (email, environment)
  // This could be stored in a separate metadata system if required
  log.info("Saved API key to unified auth", { 
    environment: data.environment,
    email: data.email.substring(0, 3) + "***" // Masked for logging
  });
}

export async function getAuth(): Promise<AuthData | null> {
  await ensureMigration();
  
  // Try to get API key from unified auth system
  const credential = await UnifiedAuth.get("kuuzuki-api");
  if (!credential || credential.type !== "api") {
    return null;
  }
  
  // Convert back to legacy AuthData format
  // Note: email and environment info may be lost in migration
  // This is acceptable as the new system doesn't require this metadata
  return {
    apiKey: credential.key,
    email: "migrated@kuuzuki.com", // Placeholder - original email may be lost
    savedAt: credential.createdAt || Date.now(),
    environment: getKeyEnvironment(credential.key) || "live"
  };
}

export async function clearAuth(): Promise<void> {
  await ensureMigration();
  
  // Remove from unified auth system
  await UnifiedAuth.remove("kuuzuki-api");
  log.info("Cleared API key from unified auth");
}

export function validateApiKeyFormat(key: string): boolean {
  return /^kz_(live|test)_[a-z0-9]{32}$/.test(key)
}

export function getKeyEnvironment(key: string): "live" | "test" | null {
  if (key.startsWith("kz_live_")) return "live"
  if (key.startsWith("kz_test_")) return "test"
  return null
}

export function maskApiKey(key: string): string {
  if (!validateApiKeyFormat(key)) return key

  const parts = key.split("_")
  const prefix = `${parts[0]}_${parts[1]}_`
  const random = parts[2]
  const masked = random.slice(0, 4) + "****" + random.slice(-4)

  return prefix + masked
}

// Get API key from environment or storage
export async function getApiKey(): Promise<string | null> {
  // 1. Check environment variable (highest priority)
  const envKey = process.env["KUUZUKI_API_KEY"]
  if (envKey && validateApiKeyFormat(envKey)) {
    return envKey
  }

  // 2. Check unified auth storage
  await ensureMigration();
  const credential = await UnifiedAuth.get("kuuzuki-api");
  
  if (credential && credential.type === "api") {
    return credential.key;
  }
  
  return null;
}
