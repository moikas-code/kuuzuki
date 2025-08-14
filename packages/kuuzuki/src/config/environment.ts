import { z } from "zod";
import { Log } from "../util/log";
import { ConfigSchema } from "./schema";

export namespace Environment {
  const log = Log.create({ service: "environment" });

  // Complete environment variable mapping for OpenCode parity
  export const ENV_MAPPINGS = {
    // Core configuration paths
    KUUZUKI_CONFIG: "configPath",
    OPENCODE_CONFIG: "configPath", // OpenCode compatibility
    OPENCODE_PATH: "configPath", // OpenCode compatibility

    // API Keys - Enhanced mapping
    ANTHROPIC_API_KEY: "provider.anthropic.options.apiKey",
    CLAUDE_API_KEY: "provider.anthropic.options.apiKey",
    OPENAI_API_KEY: "provider.openai.options.apiKey",
    OPENROUTER_API_KEY: "provider.openrouter.options.apiKey",
    GITHUB_TOKEN: "provider.github.options.apiKey",
    COPILOT_API_KEY: "provider.copilot.options.apiKey",
    AWS_ACCESS_KEY_ID: "provider.bedrock.options.accessKeyId",
    AWS_SECRET_ACCESS_KEY: "provider.bedrock.options.secretAccessKey",
    AWS_BEARER_TOKEN_BEDROCK: "provider.bedrock.options.bearerToken",
    GOOGLE_API_KEY: "provider.google.options.apiKey",
    AZURE_API_KEY: "provider.azure.options.apiKey",
    COHERE_API_KEY: "provider.cohere.options.apiKey",

    // Model configuration
    KUUZUKI_MODEL: "model",
    KUUZUKI_SMALL_MODEL: "small_model",
    OPENCODE_MODEL: "model", // OpenCode compatibility
    OPENCODE_SMALL_MODEL: "small_model", // OpenCode compatibility

    // User preferences
    KUUZUKI_USERNAME: "username",
    KUUZUKI_THEME: "theme",
    KUUZUKI_API_URL: "apiUrl",
    OPENCODE_USERNAME: "username", // OpenCode compatibility
    OPENCODE_THEME: "theme", // OpenCode compatibility
    OPENCODE_API_URL: "apiUrl", // OpenCode compatibility

    // Feature flags
    KUUZUKI_SHARE: "share",
    KUUZUKI_AUTOUPDATE: "autoupdate",
    KUUZUKI_DISABLE_AUTOUPDATE: "disableAutoupdate",
    KUUZUKI_SUBSCRIPTION_REQUIRED: "subscriptionRequired",
    KUUZUKI_DISABLED_PROVIDERS: "disabled_providers",
    KUUZUKI_DISABLE_SNAPSHOTS: "disableSnapshots",

    // OpenCode compatibility feature flags
    OPENCODE_SHARE: "share",
    OPENCODE_AUTOUPDATE: "autoupdate",
    OPENCODE_DISABLE_AUTOUPDATE: "disableAutoupdate",
    OPENCODE_SUBSCRIPTION_REQUIRED: "subscriptionRequired",
    OPENCODE_DISABLED_PROVIDERS: "disabled_providers",
    OPENCODE_DISABLE_SNAPSHOTS: "disableSnapshots",

    // Permission system - Enhanced support
    KUUZUKI_PERMISSION: "permission",
    OPENCODE_PERMISSION: "permission", // OpenCode compatibility

    // Advanced configuration
    KUUZUKI_EXPERIMENTAL_FEATURES: "experimental.features",
    KUUZUKI_PERFORMANCE_CACHE_SIZE: "experimental.performance.cacheSize",
    KUUZUKI_PERFORMANCE_MAX_CONCURRENT: "experimental.performance.maxConcurrentRequests",
    KUUZUKI_LAYOUT: "layout",
    KUUZUKI_KEYBINDS: "keybinds",

    // OpenCode branding compatibility
    OPENCODE: "opencode",

    // Debug and development
    KUUZUKI_DEBUG: "debug",
    KUUZUKI_LOG_LEVEL: "logLevel",
    KUUZUKI_DEV_MODE: "devMode",
    OPENCODE_DEBUG: "debug", // OpenCode compatibility
    OPENCODE_LOG_LEVEL: "logLevel", // OpenCode compatibility

    // MCP configuration
    KUUZUKI_MCP_SERVERS: "mcp",
    OPENCODE_MCP_SERVERS: "mcp", // OpenCode compatibility

    // Agent configuration
    KUUZUKI_AGENT_CONFIG: "agent",
    KUUZUKI_PREFERRED_TOOLS: "agent.preferredTools",
    KUUZUKI_DISABLED_TOOLS: "agent.disabledTools",
    KUUZUKI_SECURITY_LEVEL: "agent.securityLevel",
    KUUZUKI_PRIVACY_MODE: "agent.privacyMode",

    // Provider-specific configuration
    KUUZUKI_PROVIDER_TIMEOUT: "provider.*.options.timeout",
    KUUZUKI_PROVIDER_RETRIES: "provider.*.options.retries",
    KUUZUKI_PROVIDER_BASE_URL: "provider.*.options.baseURL",

    // Experimental OpenCode compatibility
    OPENCODE_EXPERIMENTAL: "experimental",
    OPENCODE_HOOKS: "experimental.hook",
  } as const;

  // Priority system for environment variables (higher number = higher priority)
  export const ENV_PRIORITY = {
    // Kuuzuki-specific variables have highest priority
    KUUZUKI_CONFIG: 100,
    KUUZUKI_MODEL: 100,
    KUUZUKI_THEME: 100,
    KUUZUKI_AUTOUPDATE: 100,
    KUUZUKI_PERMISSION: 100,

    // OpenCode compatibility variables have lower priority
    OPENCODE_CONFIG: 80,
    OPENCODE: 70, // Lowest priority for generic OPENCODE var
    OPENCODE_MODEL: 80,
    OPENCODE_THEME: 80,
    OPENCODE_DISABLE_AUTOUPDATE: 80,
    OPENCODE_PERMISSION: 80,

    // API keys have medium priority (provider-specific)
    ANTHROPIC_API_KEY: 90,
    CLAUDE_API_KEY: 85, // Lower than ANTHROPIC_API_KEY
    OPENAI_API_KEY: 90,
    GITHUB_TOKEN: 90,
  } as const;

  // Environment variable validation schema
  export const EnvSchema = z.object({
    // Configuration paths
    KUUZUKI_CONFIG: z.string().optional(),
    OPENCODE_CONFIG: z.string().optional(),
    OPENCODE: z.string().optional(),

    // API Keys
    ANTHROPIC_API_KEY: z.string().optional(),
    CLAUDE_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    COPILOT_API_KEY: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_BEARER_TOKEN_BEDROCK: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    AZURE_API_KEY: z.string().optional(),
    COHERE_API_KEY: z.string().optional(),

    // Model configuration
    KUUZUKI_MODEL: z.string().optional(),
    KUUZUKI_SMALL_MODEL: z.string().optional(),
    OPENCODE_MODEL: z.string().optional(),
    OPENCODE_SMALL_MODEL: z.string().optional(),

    // User preferences
    KUUZUKI_USERNAME: z.string().optional(),
    KUUZUKI_THEME: z.string().optional(),
    KUUZUKI_API_URL: z.string().url().optional(),
    OPENCODE_USERNAME: z.string().optional(),
    OPENCODE_THEME: z.string().optional(),
    OPENCODE_API_URL: z.string().url().optional(),

    // Feature flags with validation
    KUUZUKI_SHARE: z.enum(["manual", "auto", "disabled"]).optional(),
    KUUZUKI_AUTOUPDATE: z.coerce.boolean().optional(),
    KUUZUKI_DISABLE_AUTOUPDATE: z.coerce.boolean().optional(),
    KUUZUKI_SUBSCRIPTION_REQUIRED: z.coerce.boolean().optional(),
    KUUZUKI_DISABLED_PROVIDERS: z.string().optional(),
    KUUZUKI_DISABLE_SNAPSHOTS: z.coerce.boolean().optional(),

    // OpenCode compatibility
    OPENCODE_SHARE: z.enum(["manual", "auto", "disabled"]).optional(),
    OPENCODE_AUTOUPDATE: z.coerce.boolean().optional(),
    OPENCODE_DISABLE_AUTOUPDATE: z.coerce.boolean().optional(),
    OPENCODE_SUBSCRIPTION_REQUIRED: z.coerce.boolean().optional(),
    OPENCODE_DISABLED_PROVIDERS: z.string().optional(),
    OPENCODE_DISABLE_SNAPSHOTS: z.coerce.boolean().optional(),

    // Permission system
    KUUZUKI_PERMISSION: z.string().optional(),
    OPENCODE_PERMISSION: z.string().optional(),

    // Advanced configuration
    KUUZUKI_EXPERIMENTAL_FEATURES: z.string().optional(),
    KUUZUKI_PERFORMANCE_CACHE_SIZE: z.coerce.number().min(1).max(1000).optional(),
    KUUZUKI_PERFORMANCE_MAX_CONCURRENT: z.coerce.number().min(1).max(50).optional(),
    KUUZUKI_LAYOUT: z.enum(["auto", "stretch"]).optional(),
    KUUZUKI_KEYBINDS: z.string().optional(),

    // Debug and development
    KUUZUKI_DEBUG: z.coerce.boolean().optional(),
    KUUZUKI_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
    KUUZUKI_DEV_MODE: z.coerce.boolean().optional(),
    OPENCODE_DEBUG: z.coerce.boolean().optional(),
    OPENCODE_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),

    // MCP and Agent configuration
    KUUZUKI_MCP_SERVERS: z.string().optional(),
    OPENCODE_MCP_SERVERS: z.string().optional(),
    KUUZUKI_AGENT_CONFIG: z.string().optional(),
    KUUZUKI_PREFERRED_TOOLS: z.string().optional(),
    KUUZUKI_DISABLED_TOOLS: z.string().optional(),
    KUUZUKI_SECURITY_LEVEL: z.enum(["strict", "normal", "permissive"]).optional(),
    KUUZUKI_PRIVACY_MODE: z.coerce.boolean().optional(),

    // Provider configuration
    KUUZUKI_PROVIDER_TIMEOUT: z.coerce.number().min(1000).max(300000).optional(),
    KUUZUKI_PROVIDER_RETRIES: z.coerce.number().min(0).max(10).optional(),
    KUUZUKI_PROVIDER_BASE_URL: z.string().url().optional(),

    // Experimental
    OPENCODE_EXPERIMENTAL: z.string().optional(),
    OPENCODE_HOOKS: z.string().optional(),
  });

  export type EnvVars = z.infer<typeof EnvSchema>;

  /**
   * Parse and validate environment variables with priority system
   */
  export function parseEnvironmentVariables(): Partial<ConfigSchema.ConfigInput> {
    const config: any = {};
    const envVarsLoaded: string[] = [];
    const conflicts: Array<{ winner: string; loser: string; path: string }> = [];

    // Get all environment variables and validate them
    const rawEnv = process.env;
    const validatedEnv = EnvSchema.parse(rawEnv);

    // Process environment variables with priority system
    const processedPaths = new Set<string>();

    // Sort environment variables by priority (highest first)
    const sortedEnvVars = Object.entries(ENV_MAPPINGS)
      .filter(([envVar]) => validatedEnv[envVar as keyof EnvVars] !== undefined)
      .sort(([a], [b]) => {
        const priorityA = ENV_PRIORITY[a as keyof typeof ENV_PRIORITY] || 50;
        const priorityB = ENV_PRIORITY[b as keyof typeof ENV_PRIORITY] || 50;
        return priorityB - priorityA; // Descending order
      });

    for (const [envVar, configPath] of sortedEnvVars) {
      const value = validatedEnv[envVar as keyof EnvVars];
      if (value === undefined) continue;

      // Check for conflicts
      if (processedPaths.has(configPath)) {
        const existingVar = envVarsLoaded.find(v => ENV_MAPPINGS[v as keyof typeof ENV_MAPPINGS] === configPath);
        if (existingVar) {
          conflicts.push({
            winner: existingVar,
            loser: envVar,
            path: configPath,
          });
          continue; // Skip this variable due to conflict
        }
      }

      // Special handling for different variable types
      if (envVar.includes("PERMISSION")) {
        try {
          const parsed = JSON.parse(value as string);
          setNestedValue(config, configPath, parsed);
          envVarsLoaded.push(envVar);
          processedPaths.add(configPath);
        } catch (error) {
          log.warn(`Invalid JSON in ${envVar} environment variable`, { error, value });
          continue;
        }
      } else if (envVar.includes("DISABLED_PROVIDERS")) {
        // Parse comma-separated list
        const providers = (value as string).split(",").map(p => p.trim()).filter(Boolean);
        setNestedValue(config, configPath, providers);
        envVarsLoaded.push(envVar);
        processedPaths.add(configPath);
      } else if (envVar.includes("EXPERIMENTAL") || envVar.includes("MCP") || envVar.includes("AGENT")) {
        try {
          const parsed = JSON.parse(value as string);
          setNestedValue(config, configPath, parsed);
          envVarsLoaded.push(envVar);
          processedPaths.add(configPath);
        } catch (error) {
          // If not JSON, treat as string
          setNestedValue(config, configPath, parseEnvValue(value as string));
          envVarsLoaded.push(envVar);
          processedPaths.add(configPath);
        }
      } else if (envVar.includes("DISABLE_AUTOUPDATE")) {
        // Special handling for autoupdate disable flags
        const boolValue = parseEnvValue(value as string);
        if (typeof boolValue === "boolean") {
          setNestedValue(config, "disableAutoupdate", boolValue);
          setNestedValue(config, "autoupdate", !boolValue); // Inverse for autoupdate
          envVarsLoaded.push(envVar);
          processedPaths.add(configPath);
        }
      } else {
        setNestedValue(config, configPath, parseEnvValue(value as string));
        envVarsLoaded.push(envVar);
        processedPaths.add(configPath);
      }
    }

    // Log environment variable usage
    if (envVarsLoaded.length > 0) {
      log.info("Loaded environment variables", { 
        variables: envVarsLoaded,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      });
    }

    if (conflicts.length > 0) {
      log.warn("Environment variable conflicts resolved by priority", { conflicts });
    }

    return config;
  }

  /**
   * Get configuration path from environment variables with priority
   */
  export function getConfigPath(): string | undefined {
    // Priority order: KUUZUKI_CONFIG > OPENCODE_CONFIG > OPENCODE
    return process.env.KUUZUKI_CONFIG || 
           process.env.OPENCODE_CONFIG || 
           process.env.OPENCODE;
  }

  /**
   * Check if autoupdate is disabled via environment variables
   */
  export function isAutoupdateDisabled(): boolean {
    // Check both kuuzuki and OpenCode environment variables
    const kuuzukiDisabled = parseEnvValue(process.env.KUUZUKI_DISABLE_AUTOUPDATE || "");
    const opencodeDisabled = parseEnvValue(process.env.OPENCODE_DISABLE_AUTOUPDATE || "");
    const kuuzukiAutoupdate = parseEnvValue(process.env.KUUZUKI_AUTOUPDATE || "");
    
    // If explicitly disabled, return true
    if (kuuzukiDisabled === true || opencodeDisabled === true) {
      return true;
    }
    
    // If kuuzuki autoupdate is explicitly false, return true
    if (kuuzukiAutoupdate === false) {
      return true;
    }
    
    return false;
  }

  /**
   * Get permission configuration from environment variables
   */
  export function getPermissionFromEnv(): any | null {
    // Priority: KUUZUKI_PERMISSION > OPENCODE_PERMISSION
    const kuuzukiPermission = process.env.KUUZUKI_PERMISSION;
    const opencodePermission = process.env.OPENCODE_PERMISSION;
    
    const permissionStr = kuuzukiPermission || opencodePermission;
    if (!permissionStr) return null;
    
    try {
      return JSON.parse(permissionStr);
    } catch (error) {
      log.warn("Invalid JSON in permission environment variable", { 
        variable: kuuzukiPermission ? "KUUZUKI_PERMISSION" : "OPENCODE_PERMISSION",
        error 
      });
      return null;
    }
  }

  /**
   * Validate environment variable configuration
   */
  export function validateEnvironment(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      EnvSchema.parse(process.env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push(`${issue.path.join(".")}: ${issue.message}`);
        }
      }
    }

    // Check for common configuration issues
    const apiKeys = [
      "ANTHROPIC_API_KEY",
      "CLAUDE_API_KEY", 
      "OPENAI_API_KEY",
      "OPENROUTER_API_KEY"
    ];
    
    const hasApiKey = apiKeys.some(key => process.env[key]);
    if (!hasApiKey) {
      warnings.push("No AI provider API keys found in environment variables");
    }

    // Check for conflicting autoupdate settings
    const hasKuuzukiAutoupdate = process.env.KUUZUKI_AUTOUPDATE !== undefined;
    const hasKuuzukiDisableAutoupdate = process.env.KUUZUKI_DISABLE_AUTOUPDATE !== undefined;
    const hasOpencodeDisableAutoupdate = process.env.OPENCODE_DISABLE_AUTOUPDATE !== undefined;
    
    if ((hasKuuzukiAutoupdate && hasKuuzukiDisableAutoupdate) ||
        (hasKuuzukiAutoupdate && hasOpencodeDisableAutoupdate)) {
      warnings.push("Conflicting autoupdate environment variables detected");
    }

    // Check for permission conflicts
    if (process.env.KUUZUKI_PERMISSION && process.env.OPENCODE_PERMISSION) {
      warnings.push("Both KUUZUKI_PERMISSION and OPENCODE_PERMISSION are set - KUUZUKI_PERMISSION takes priority");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get all loaded environment variables for debugging
   */
  export function getLoadedEnvVars(): Record<string, any> {
    const loaded: Record<string, any> = {};
    
    for (const [envVar, configPath] of Object.entries(ENV_MAPPINGS)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        loaded[envVar] = {
          value: envVar.includes("API_KEY") || envVar.includes("TOKEN") ? "***" : value,
          configPath,
          priority: ENV_PRIORITY[envVar as keyof typeof ENV_PRIORITY] || 50,
        };
      }
    }
    
    return loaded;
  }

  /**
   * Set nested value in configuration object
   */
  function setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key === "*") {
        // Handle wildcard paths for provider configuration
        continue;
      }
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    const finalKey = keys[keys.length - 1];
    if (finalKey !== "*") {
      current[finalKey] = value;
    }
  }

  /**
   * Parse environment variable value with type coercion
   */
  function parseEnvValue(value: string): any {
    if (!value) return value;

    // Handle boolean values
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === "true" || lowerValue === "1" || lowerValue === "yes") {
      return true;
    }
    if (lowerValue === "false" || lowerValue === "0" || lowerValue === "no") {
      return false;
    }

    // Handle numbers
    const numValue = Number(value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }

    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not JSON
      return value;
    }
  }

  /**
   * Export environment variables for external tools
   */
  export function exportForExternal(): Record<string, string> {
    const exported: Record<string, string> = {};
    
    // Export kuuzuki-specific variables
    for (const envVar of Object.keys(ENV_MAPPINGS)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        exported[envVar] = value;
      }
    }
    
    return exported;
  }
}