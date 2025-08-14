import { z } from "zod";
import { Log } from "../util/log";
import { NamedError } from "../util/error";

export namespace PermissionSystem {
  const log = Log.create({ service: "permission-system" });

  // Enhanced permission configuration schema
  export const PermissionConfigSchema = z.union([
    // Simple array format (OpenCode compatibility)
    z.array(z.string()).describe("Simple array of command patterns requiring permission"),
    
    // Enhanced object format with advanced features
    z.object({
      // Tool-specific permissions
      edit: z.enum(["ask", "allow", "deny"]).optional().describe("Permission for file editing operations"),
      bash: z.union([
        z.enum(["ask", "allow", "deny"]).describe("Global bash permission setting"),
        z.record(z.string(), z.enum(["ask", "allow", "deny"])).describe("Pattern-based bash permissions")
      ]).optional().describe("Permission for bash command execution"),
      webfetch: z.enum(["ask", "allow", "deny"]).optional().describe("Permission for web content fetching"),
      write: z.enum(["ask", "allow", "deny"]).optional().describe("Permission for file writing operations"),
      read: z.enum(["ask", "allow", "deny"]).optional().describe("Permission for file reading operations"),
      
      // Tool name pattern matching
      tools: z.record(z.string(), z.enum(["ask", "allow", "deny"])).optional()
        .describe("Tool name pattern-based permissions (e.g., '*' for all tools, 'bash*' for bash-like tools)"),
      
      // Advanced pattern configuration
      patterns: z.object({
        priority: z.enum(["specificity", "order", "length"]).default("specificity").optional()
          .describe("Pattern matching priority algorithm"),
        caseSensitive: z.boolean().default(false).optional()
          .describe("Enable case-sensitive pattern matching"),
        implicitWildcard: z.boolean().default(true).optional()
          .describe("Add implicit wildcards to command patterns (OpenCode compatibility)"),
        maxPatternLength: z.number().min(1).max(1000).default(100).optional()
          .describe("Maximum pattern length for security"),
      }).optional().describe("Advanced pattern matching configuration"),
      
      // Agent-specific permissions override global settings
      agents: z.record(z.string(), z.object({
        edit: z.enum(["ask", "allow", "deny"]).optional(),
        bash: z.union([
          z.enum(["ask", "allow", "deny"]),
          z.record(z.string(), z.enum(["ask", "allow", "deny"]))
        ]).optional(),
        webfetch: z.enum(["ask", "allow", "deny"]).optional(),
        write: z.enum(["ask", "allow", "deny"]).optional(),
        read: z.enum(["ask", "allow", "deny"]).optional(),
        tools: z.record(z.string(), z.enum(["ask", "allow", "deny"])).optional(),
        
        // Agent-specific pattern overrides
        patterns: z.object({
          priority: z.enum(["specificity", "order", "length"]).optional(),
          caseSensitive: z.boolean().optional(),
          implicitWildcard: z.boolean().optional(),
        }).optional(),
        
        // Inheritance control
        inherit: z.boolean().default(true).optional().describe("Inherit global permissions"),
        override: z.boolean().default(false).optional().describe("Override all inherited permissions"),
      })).optional().describe("Agent-specific permission overrides"),
      
      // Environment-based overrides
      environments: z.record(z.string(), z.object({
        edit: z.enum(["ask", "allow", "deny"]).optional(),
        bash: z.union([
          z.enum(["ask", "allow", "deny"]),
          z.record(z.string(), z.enum(["ask", "allow", "deny"]))
        ]).optional(),
        webfetch: z.enum(["ask", "allow", "deny"]).optional(),
        write: z.enum(["ask", "allow", "deny"]).optional(),
        read: z.enum(["ask", "allow", "deny"]).optional(),
        tools: z.record(z.string(), z.enum(["ask", "allow", "deny"])).optional(),
      })).optional().describe("Environment-specific permission overrides (development, production, etc.)"),
      
      // Security hardening
      security: z.object({
        requireConfirmation: z.array(z.string()).optional()
          .describe("Operations that always require user confirmation"),
        blockedPatterns: z.array(z.string()).optional()
          .describe("Patterns that are always blocked for security"),
        allowedDomains: z.array(z.string()).optional()
          .describe("Allowed domains for webfetch operations"),
        maxFileSize: z.number().min(1).max(1000000000).optional()
          .describe("Maximum file size for read/write operations (bytes)"),
        auditLog: z.boolean().default(true).optional()
          .describe("Enable audit logging for permission decisions"),
      }).optional().describe("Security hardening configuration"),
      
      // Timeout and retry configuration
      timeouts: z.object({
        userResponse: z.number().min(1000).max(300000).default(30000).optional()
          .describe("Timeout for user permission responses (ms)"),
        operationTimeout: z.number().min(1000).max(600000).default(120000).optional()
          .describe("Timeout for operations requiring permission (ms)"),
        retryAttempts: z.number().min(0).max(5).default(1).optional()
          .describe("Number of retry attempts for failed permission requests"),
      }).optional().describe("Timeout and retry configuration"),
    }).describe("Enhanced object format with comprehensive permission control")
  ]);

  export type PermissionConfig = z.infer<typeof PermissionConfigSchema>;
  export type Permission = "ask" | "allow" | "deny";

  // Pattern matching utilities
  export interface PatternMatch {
    pattern: string;
    permission: Permission;
    specificity: number;
    source: "global" | "agent" | "environment";
    priority: number;
  }

  /**
   * Enhanced wildcard pattern matching with priority system
   */
  export function matchPattern(
    input: string,
    patterns: Record<string, Permission>,
    options: {
      caseSensitive?: boolean;
      implicitWildcard?: boolean;
      priority?: "specificity" | "order" | "length";
    } = {}
  ): PatternMatch | null {
    const { caseSensitive = false, implicitWildcard = true, priority = "specificity" } = options;
    
    const matches: PatternMatch[] = [];
    let patternIndex = 0;

    for (const [pattern, permission] of Object.entries(patterns)) {
      if (isPatternMatch(input, pattern, { caseSensitive, implicitWildcard })) {
        matches.push({
          pattern,
          permission,
          specificity: calculateSpecificity(pattern),
          source: "global",
          priority: patternIndex,
        });
      }
      patternIndex++;
    }

    if (matches.length === 0) return null;

    // Sort matches by priority algorithm
    matches.sort((a, b) => {
      switch (priority) {
        case "specificity":
          return b.specificity - a.specificity; // Higher specificity first
        case "order":
          return a.priority - b.priority; // Earlier patterns first
        case "length":
          return b.pattern.length - a.pattern.length; // Longer patterns first
        default:
          return b.specificity - a.specificity;
      }
    });

    return matches[0];
  }

  /**
   * Check if input matches pattern with enhanced wildcard support
   */
  function isPatternMatch(
    input: string,
    pattern: string,
    options: { caseSensitive?: boolean; implicitWildcard?: boolean } = {}
  ): boolean {
    const { caseSensitive = false, implicitWildcard = true } = options;
    
    let processedInput = caseSensitive ? input : input.toLowerCase();
    let processedPattern = caseSensitive ? pattern : pattern.toLowerCase();

    // Add implicit wildcards for OpenCode compatibility
    if (implicitWildcard && !processedPattern.includes("*")) {
      processedPattern = `*${processedPattern}*`;
    }

    // Convert glob pattern to regex
    const regexPattern = processedPattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
      .replace(/\*/g, ".*") // Convert * to .*
      .replace(/\?/g, "."); // Convert ? to .

    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(processedInput);
    } catch (error) {
      log.warn("Invalid pattern regex", { pattern: processedPattern, error });
      return false;
    }
  }

  /**
   * Calculate pattern specificity for priority matching
   */
  function calculateSpecificity(pattern: string): number {
    let specificity = 0;
    
    // Base specificity from pattern length
    specificity += pattern.length;
    
    // Reduce specificity for wildcards
    const wildcardCount = (pattern.match(/\*/g) || []).length;
    specificity -= wildcardCount * 10;
    
    // Reduce specificity for question marks
    const questionMarkCount = (pattern.match(/\?/g) || []).length;
    specificity -= questionMarkCount * 5;
    
    // Increase specificity for exact matches (no wildcards)
    if (wildcardCount === 0 && questionMarkCount === 0) {
      specificity += 100;
    }
    
    // Increase specificity for patterns with specific prefixes/suffixes
    if (pattern.startsWith("/") || pattern.startsWith("./")) {
      specificity += 20;
    }
    
    return Math.max(0, specificity);
  }

  /**
   * Resolve permission with inheritance and overrides
   */
  export function resolvePermission(
    tool: string,
    operation: string,
    config: PermissionConfig,
    context: {
      agent?: string;
      environment?: string;
      command?: string;
    } = {}
  ): {
    permission: Permission;
    source: string;
    reason: string;
    matches?: PatternMatch[];
  } {
    const { agent, environment, command } = context;

    // Handle simple array format (OpenCode compatibility)
    if (Array.isArray(config)) {
      const patterns: Record<string, Permission> = {};
      for (const pattern of config) {
        patterns[pattern] = "ask";
      }
      
      const match = matchPattern(command || `${tool} ${operation}`, patterns);
      return {
        permission: match ? match.permission : "allow",
        source: match ? "pattern" : "default",
        reason: match ? `Matched pattern: ${match.pattern}` : "No matching patterns, defaulting to allow",
        matches: match ? [match] : undefined,
      };
    }

    // Enhanced object format processing
    const matches: PatternMatch[] = [];
    let finalPermission: Permission = "ask"; // Default to ask for security
    let source = "default";
    let reason = "Default security policy";

    // 1. Check security blocked patterns first
    if (config.security?.blockedPatterns && command) {
      const blockedPatterns: Record<string, Permission> = {};
      for (const pattern of config.security.blockedPatterns) {
        blockedPatterns[pattern] = "deny";
      }
      
      const blockedMatch = matchPattern(command, blockedPatterns, config.patterns);
      if (blockedMatch) {
        return {
          permission: "deny",
          source: "security",
          reason: `Blocked by security pattern: ${blockedMatch.pattern}`,
          matches: [blockedMatch],
        };
      }
    }

    // 2. Check environment-specific permissions
    if (environment && config.environments?.[environment]) {
      const envConfig = config.environments[environment];
      const envPermission = getToolPermission(tool, envConfig);
      if (envPermission) {
        finalPermission = envPermission;
        source = "environment";
        reason = `Environment-specific permission: ${environment}`;
      }
    }

    // 3. Check agent-specific permissions
    if (agent && config.agents?.[agent]) {
      const agentConfig = config.agents[agent];
      
      // Check if agent inherits global permissions
      if (agentConfig.inherit !== false) {
        const globalPermission = getToolPermission(tool, config);
        if (globalPermission) {
          finalPermission = globalPermission;
          source = "global";
          reason = "Global permission inherited by agent";
        }
      }
      
      // Apply agent-specific overrides
      const agentPermission = getToolPermission(tool, agentConfig);
      if (agentPermission) {
        finalPermission = agentPermission;
        source = "agent";
        reason = `Agent-specific permission: ${agent}`;
      }
      
      // Check agent tool patterns
      if (agentConfig.tools && command) {
        const agentMatch = matchPattern(command, agentConfig.tools, agentConfig.patterns || config.patterns);
        if (agentMatch) {
          finalPermission = agentMatch.permission;
          source = "agent-pattern";
          reason = `Agent pattern match: ${agentMatch.pattern}`;
          matches.push({ ...agentMatch, source: "agent" });
        }
      }
    } else {
      // 4. Check global permissions
      const globalPermission = getToolPermission(tool, config);
      if (globalPermission) {
        finalPermission = globalPermission;
        source = "global";
        reason = "Global tool permission";
      }
      
      // Check global tool patterns
      if (config.tools && command) {
        const globalMatch = matchPattern(command, config.tools, config.patterns);
        if (globalMatch) {
          finalPermission = globalMatch.permission;
          source = "global-pattern";
          reason = `Global pattern match: ${globalMatch.pattern}`;
          matches.push(globalMatch);
        }
      }
    }

    // 5. Check operations requiring confirmation
    if (config.security?.requireConfirmation?.includes(operation)) {
      if (finalPermission === "allow") {
        finalPermission = "ask";
        source = "security";
        reason = "Operation requires confirmation by security policy";
      }
    }

    return {
      permission: finalPermission,
      source,
      reason,
      matches: matches.length > 0 ? matches : undefined,
    };
  }

  /**
   * Get tool-specific permission from configuration
   */
  function getToolPermission(
    tool: string,
    config: any
  ): Permission | null {
    // Direct tool permission
    if (config[tool]) {
      return typeof config[tool] === "string" ? config[tool] as Permission : null;
    }

    // Handle bash special case (can be string or object)
    if (tool === "bash" && config.bash) {
      return typeof config.bash === "string" ? config.bash as Permission : null;
    }

    return null;
  }

  /**
   * Validate permission configuration
   */
  export function validatePermissionConfig(config: unknown): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = { valid: true, errors: [] as string[], warnings: [] as string[] };

    try {
      PermissionConfigSchema.parse(config);
    } catch (error) {
      result.valid = false;
      if (error instanceof z.ZodError) {
        result.errors = error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`);
      } else {
        result.errors.push(`Validation error: ${error}`);
      }
    }

    // Additional validation warnings
    if (typeof config === "object" && config !== null && !Array.isArray(config)) {
      const objConfig = config as any;
      
      // Warn about overly permissive configurations
      if (objConfig.bash === "allow" && objConfig.write === "allow") {
        result.warnings.push("Configuration allows both bash and write operations - consider security implications");
      }
      
      // Warn about missing security configuration
      if (!objConfig.security) {
        result.warnings.push("No security configuration specified - consider adding security hardening");
      }
      
      // Warn about agent configurations without inheritance control
      if (objConfig.agents) {
        for (const [agentName, agentConfig] of Object.entries(objConfig.agents)) {
          if (typeof agentConfig === "object" && agentConfig !== null) {
            const agent = agentConfig as any;
            if (agent.inherit === undefined && agent.override === undefined) {
              result.warnings.push(`Agent ${agentName} has no inheritance control specified`);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Convert simple array format to enhanced object format
   */
  export function upgradePermissionConfig(config: string[]): PermissionConfig {
    const patterns: Record<string, Permission> = {};
    for (const pattern of config) {
      patterns[pattern] = "ask";
    }

    return {
      tools: patterns,
      patterns: {
        priority: "specificity",
        caseSensitive: false,
        implicitWildcard: true,
      },
      security: {
        auditLog: true,
      },
      timeouts: {
        userResponse: 30000,
        operationTimeout: 120000,
        retryAttempts: 1,
      },
    };
  }

  /**
   * Merge permission configurations with precedence
   */
  export function mergePermissionConfigs(
    base: PermissionConfig,
    override: PermissionConfig
  ): PermissionConfig {
    // If either is array format, convert to object format first
    const baseObj = Array.isArray(base) ? upgradePermissionConfig(base) : base;
    const overrideObj = Array.isArray(override) ? upgradePermissionConfig(override) : override;

    // Deep merge with special handling for specific fields
    const merged = { ...baseObj } as any;

    // Merge tool permissions
    if (!Array.isArray(overrideObj) && overrideObj.tools) {
      merged.tools = { ...merged.tools, ...overrideObj.tools };
    }

    // Merge agent configurations
    if (!Array.isArray(overrideObj) && overrideObj.agents) {
      merged.agents = { ...merged.agents, ...overrideObj.agents };
    }

    // Merge environment configurations
    if (!Array.isArray(overrideObj) && overrideObj.environments) {
      merged.environments = { ...merged.environments, ...overrideObj.environments };
    }

    // Override simple permissions
    if (!Array.isArray(overrideObj)) {
      if (overrideObj.edit) merged.edit = overrideObj.edit;
      if (overrideObj.webfetch) merged.webfetch = overrideObj.webfetch;
      if (overrideObj.write) merged.write = overrideObj.write;
      if (overrideObj.read) merged.read = overrideObj.read;

      // Handle bash permissions (can be string or object)
      if (overrideObj.bash) {
        merged.bash = overrideObj.bash;
      }

      // Merge patterns configuration
      if (overrideObj.patterns) {
        merged.patterns = { ...merged.patterns, ...overrideObj.patterns };
      }

      // Merge security configuration
      if (overrideObj.security) {
        merged.security = { ...merged.security, ...overrideObj.security };
      }

      // Merge timeouts configuration
      if (overrideObj.timeouts) {
        merged.timeouts = { ...merged.timeouts, ...overrideObj.timeouts };
      }
    }

    return merged;
  }

  /**
   * Get permission audit log entry
   */
  export function createAuditLogEntry(
    tool: string,
    operation: string,
    permission: Permission,
    context: {
      agent?: string;
      environment?: string;
      command?: string;
      source?: string;
      reason?: string;
      userResponse?: boolean;
      timestamp?: number;
    } = {}
  ): Record<string, any> {
    return {
      timestamp: context.timestamp || Date.now(),
      tool,
      operation,
      permission,
      agent: context.agent,
      environment: context.environment,
      command: context.command,
      source: context.source || "unknown",
      reason: context.reason || "No reason provided",
      userResponse: context.userResponse,
      sessionId: process.env.KUUZUKI_SESSION_ID,
    };
  }

  // Error types
  export const PermissionError = NamedError.create(
    "PermissionError",
    z.object({
      tool: z.string(),
      operation: z.string(),
      permission: z.enum(["ask", "allow", "deny"]),
      reason: z.string(),
      agent: z.string().optional(),
    })
  );

  export const PatternError = NamedError.create(
    "PatternError",
    z.object({
      pattern: z.string(),
      input: z.string(),
      message: z.string(),
    })
  );
}