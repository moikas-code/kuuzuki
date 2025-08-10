import { z } from "zod";
import { UnifiedAuth } from "./unified-auth";
import { AuthMigration } from "./migration";
import { Log } from "../util/log";

const log = Log.create({ service: "auth" });

export namespace Auth {
  export const Oauth = z.object({
    type: z.literal("oauth"),
    refresh: z.string(),
    access: z.string(),
    expires: z.number(),
  });

  export const Api = z.object({
    type: z.literal("api"),
    key: z.string(),
  });

  export const WellKnown = z.object({
    type: z.literal("wellknown"),
    key: z.string(),
    token: z.string(),
  });

  export const Info = z.discriminatedUnion("type", [Oauth, Api, WellKnown]);
  export type Info = z.infer<typeof Info>;

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

  /**
   * Convert UnifiedAuth.Credential to legacy Auth.Info format
   */
  function convertFromUnified(credential: UnifiedAuth.Credential): Info {
    switch (credential.type) {
      case "oauth":
        return {
          type: "oauth",
          refresh: credential.refresh,
          access: credential.access,
          expires: credential.expires,
        };
      case "api":
        return {
          type: "api",
          key: credential.key,
        };
      case "wellknown":
        return {
          type: "wellknown",
          key: credential.key,
          token: credential.token,
        };
      default:
        throw new Error(`Unknown credential type: ${(credential as any).type}`);
    }
  }

  /**
   * Convert legacy Auth.Info to UnifiedAuth.Credential format
   */
  function convertToUnified(info: Info): UnifiedAuth.Credential {
    switch (info.type) {
      case "oauth":
        return {
          type: "oauth",
          refresh: info.refresh,
          access: info.access,
          expires: info.expires,
        };
      case "api":
        return {
          type: "api",
          key: info.key,
          source: "manual" as const,
        };
      case "wellknown":
        return {
          type: "wellknown",
          key: info.key,
          token: info.token,
        };
      default:
        throw new Error(`Unknown info type: ${(info as any).type}`);
    }
  }

  export async function get(providerID: string): Promise<Info | undefined> {
    await ensureMigration();
    
    const credential = await UnifiedAuth.get(providerID);
    if (!credential) return undefined;
    
    return convertFromUnified(credential);
  }

  export async function all(): Promise<Record<string, Info>> {
    await ensureMigration();
    
    const credentials = await UnifiedAuth.all();
    const result: Record<string, Info> = {};
    
    for (const [providerID, credential] of Object.entries(credentials)) {
      result[providerID] = convertFromUnified(credential);
    }
    
    return result;
  }

  export async function set(key: string, info: Info): Promise<void> {
    await ensureMigration();
    
    const credential = convertToUnified(info);
    await UnifiedAuth.set(key, credential);
  }

  export async function remove(key: string): Promise<void> {
    await ensureMigration();
    
    await UnifiedAuth.remove(key);
  }
}
