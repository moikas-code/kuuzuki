import { z } from "zod";
import { Log } from "../util/log";
import { ConfigSchema } from "./schema";
import { NamedError } from "../util/error";
import { mergeDeep } from "remeda";

export namespace AgentConfig {
  const log = Log.create({ service: "agent-config" });

  // Enhanced agent configuration schema with inheritance
  export const AgentPermissionSchema = z.object({
    edit: z.enum(["ask", "allow", "deny"]).optional(),
    bash: z.union([
      z.enum(["ask", "allow", "deny"]),
      z.record(z.string(), z.enum(["ask", "allow", "deny"]))
    ]).optional(),
    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
    write: z.enum(["ask", "allow", "deny"]).optional(),
    read: z.enum(["ask", "allow", "deny"]).optional(),
    tools: z.record(z.string(), z.enum(["ask", "allow", "deny"])).optional(),
  });

  export const AgentConfigSchema = ConfigSchema.Agent.extend({
    // Enhanced agent configuration
    permissions: AgentPermissionSchema.optional().describe("Agent-specific permission overrides"),
    inherits: z.string().optional().describe("Parent agent to inherit configuration from"),
    priority: z.number().min(0).max(100).default(50).describe("Agent priority for selection"),
    enabled: z.boolean().default(true).describe("Whether the agent is enabled"),
    
    // Startup behavior
    autoStart: z.boolean().default(false).describe("Automatically start this agent"),
    startupDelay: z.number().min(0).max(60000).default(0).describe("Delay before starting agent (ms)"),
    
    // Resource limits
    maxMemory: z.number().min(1).max(8192).optional().describe("Maximum memory usage in MB"),
    maxConcurrentTasks: z.number().min(1).max(50).default(5).describe("Maximum concurrent tasks"),
    timeout: z.number().min(1000).max(300000).default(30000).describe("Task timeout in milliseconds"),
    
    // Model preferences with fallbacks
    preferredModels: z.array(z.string()).optional().describe("Preferred models in order of preference"),
    fallbackModel: z.string().optional().describe("Fallback model if preferred models are unavailable"),
    
    // Tool configuration
    requiredTools: z.array(z.string()).optional().describe("Tools required for this agent to function"),
    optionalTools: z.array(z.string()).optional().describe("Optional tools that enhance agent capabilities"),
    disabledTools: z.array(z.string()).optional().describe("Tools to disable for this agent"),
    
    // Context management
    contextWindow: z.number().min(1000).max(2000000).optional().describe("Context window size for this agent"),
    contextPreservation: z.boolean().default(true).describe("Preserve context between tasks"),
    contextCompression: z.boolean().default(false).describe("Enable context compression"),
    
    // Security and privacy
    securityLevel: z.enum(["strict", "normal", "permissive"]).default("normal").describe("Security level"),
    privacyMode: z.boolean().default(false).describe("Enable privacy mode"),
    auditLog: z.boolean().default(true).describe("Enable audit logging"),
    
    // Experimental features
    experimental: z.object({
      multiModal: z.boolean().default(false).describe("Enable multi-modal capabilities"),
      streaming: z.boolean().default(true).describe("Enable streaming responses"),
      caching: z.boolean().default(true).describe("Enable response caching"),
      parallelExecution: z.boolean().default(false).describe("Enable parallel task execution"),
    }).optional().describe("Experimental features"),
  });

  export type AgentConfig = z.infer<typeof AgentConfigSchema>;
  export type AgentPermission = z.infer<typeof AgentPermissionSchema>;

  // Default agent configurations
  export const DEFAULT_AGENTS: Record<string, Partial<AgentConfig>> = {
    general: {
      name: "general",
      description: "General-purpose AI assistant for various tasks",
      priority: 50,
      tools: {
        bash: true,
        edit: true,
        read: true,
        write: true,
        webfetch: true,
        grep: true,
        glob: true,
      },
      permissions: {
        edit: "ask",
        bash: "ask",
        webfetch: "allow",
        write: "ask",
        read: "allow",
      },
    },
    
    bugfinder: {
      name: "bugfinder",
      description: "Expert debugging agent for systematic bug identification and analysis",
      priority: 80,
      model: "anthropic/claude-sonnet-4-20250514",
      tools: {
        bash: true,
        read: true,
        write: false,
        edit: true,
        grep: true,
        glob: true,
        moidvk_check_code_practices: true,
        moidvk_scan_security_vulnerabilities: true,
        moidvk_check_production_readiness: true,
      },
      permissions: {
        bash: "allow",
        edit: "allow",
        write: "deny",
        read: "allow",
      },
      requiredTools: ["bash", "read", "grep"],
      securityLevel: "normal",
    },
    
    "code-reviewer": {
      name: "code-reviewer",
      description: "Expert code review agent for quality, security, and best practices analysis",
      priority: 75,
      tools: {
        read: true,
        moidvk_check_code_practices: true,
        moidvk_scan_security_vulnerabilities: true,
        bash: true,
        grep: true,
      },
      permissions: {
        bash: {
          "git *": "allow",
          "npm *": "allow",
          "rm *": "deny",
          "*": "ask",
        },
        edit: "allow",
        write: "deny",
        read: "allow",
      },
      securityLevel: "strict",
    },
    
    documentation: {
      name: "documentation",
      description: "Specialized agent for creating, updating, and maintaining project documentation",
      priority: 60,
      tools: {
        read: true,
        write: true,
        edit: true,
        glob: true,
        grep: true,
      },
      permissions: {
        bash: "deny",
        edit: "allow",
        write: "allow",
        read: "allow",
      },
      requiredTools: ["read", "write", "edit"],
    },
    
    testing: {
      name: "testing",
      description: "Comprehensive testing agent for unit tests, integration tests, and test automation",
      priority: 70,
      tools: {
        read: true,
        write: true,
        edit: true,
        bash: true,
        grep: true,
        glob: true,
      },
      permissions: {
        bash: "allow",
        edit: "allow",
        write: "allow",
        read: "allow",
      },
      requiredTools: ["bash", "read", "write"],
    },
    
    architect: {
      name: "architect",
      description: "System design and architecture planning agent for complex feature implementation",
      priority: 85,
      tools: {
        read: true,
        write: true,
        grep: true,
        glob: true,
      },
      permissions: {
        bash: "ask",
        edit: "allow",
        write: "allow",
        read: "allow",
      },
      contextWindow: 200000,
      contextPreservation: true,
    },
  };

  /**
   * Resolve agent configuration with inheritance
   */
  export function resolveAgentConfig(
    agentName: string,
    configs: Record<string, Partial<AgentConfig>>,
    visited = new Set<string>()
  ): AgentConfig {
    if (visited.has(agentName)) {
      throw new AgentConfigError({
        agentName,
        message: `Circular inheritance detected: ${Array.from(visited).join(" -> ")} -> ${agentName}`,
      });
    }

    visited.add(agentName);

    const config = configs[agentName];
    if (!config) {
      throw new AgentConfigError({
        agentName,
        message: `Agent configuration not found: ${agentName}`,
      });
    }

    let resolvedConfig = { ...config };

    // Resolve inheritance
    if (config.inherits) {
      const parentConfig = resolveAgentConfig(config.inherits, configs, visited);
      resolvedConfig = mergeAgentConfigs(parentConfig, resolvedConfig);
    }

    visited.delete(agentName);

    // Validate the resolved configuration
    try {
      return AgentConfigSchema.parse(resolvedConfig);
    } catch (error) {
      throw new AgentConfigError({
        agentName,
        message: `Invalid agent configuration: ${error}`,
      });
    }
  }

  /**
   * Merge agent configurations with proper precedence
   */
  export function mergeAgentConfigs(
    base: Partial<AgentConfig>,
    override: Partial<AgentConfig>
  ): Partial<AgentConfig> {
    const merged = mergeDeep(base, override) as Partial<AgentConfig>;

    // Special handling for tools - merge boolean values
    if (base.tools && override.tools) {
      merged.tools = { ...base.tools, ...override.tools };
    }

    // Special handling for permissions - merge with precedence
    if (base.permissions && override.permissions) {
      merged.permissions = mergePermissions(base.permissions, override.permissions);
    }

    // Arrays should be concatenated and deduplicated
    if (base.requiredTools && override.requiredTools) {
      merged.requiredTools = [...new Set([...base.requiredTools, ...override.requiredTools])];
    }

    if (base.optionalTools && override.optionalTools) {
      merged.optionalTools = [...new Set([...base.optionalTools, ...override.optionalTools])];
    }

    if (base.disabledTools && override.disabledTools) {
      merged.disabledTools = [...new Set([...base.disabledTools, ...override.disabledTools])];
    }

    if (base.preferredModels && override.preferredModels) {
      merged.preferredModels = [...new Set([...base.preferredModels, ...override.preferredModels])];
    }

    return merged;
  }

  /**
   * Merge permission configurations
   */
  function mergePermissions(
    base: AgentPermission,
    override: AgentPermission
  ): AgentPermission {
    const merged: AgentPermission = { ...base };

    // Override simple permissions
    if (override.edit) merged.edit = override.edit;
    if (override.webfetch) merged.webfetch = override.webfetch;
    if (override.write) merged.write = override.write;
    if (override.read) merged.read = override.read;

    // Handle bash permissions (can be string or object)
    if (override.bash) {
      if (typeof override.bash === "string") {
        merged.bash = override.bash;
      } else if (typeof base.bash === "object" && typeof override.bash === "object") {
        merged.bash = { ...base.bash, ...override.bash };
      } else {
        merged.bash = override.bash;
      }
    }

    // Handle tools permissions
    if (override.tools) {
      merged.tools = { ...merged.tools, ...override.tools };
    }

    return merged;
  }

  /**
   * Get default permission for an agent
   */
  export function getDefaultPermission(
    agentName: string,
    toolName: string,
    operation: string
  ): "ask" | "allow" | "deny" {
    // Security-first defaults
    const secureDefaults: Record<string, "ask" | "allow" | "deny"> = {
      bash: "ask",
      edit: "ask",
      write: "ask",
      read: "allow",
      webfetch: "allow",
      grep: "allow",
      glob: "allow",
    };

    // Agent-specific overrides
    const agentDefaults: Record<string, Record<string, "ask" | "allow" | "deny">> = {
      bugfinder: {
        bash: "allow",
        read: "allow",
        edit: "allow",
        write: "deny",
      },
      "code-reviewer": {
        bash: "ask",
        read: "allow",
        edit: "allow",
        write: "deny",
      },
      documentation: {
        bash: "deny",
        read: "allow",
        edit: "allow",
        write: "allow",
      },
    };

    return agentDefaults[agentName]?.[toolName] || secureDefaults[toolName] || "ask";
  }

  /**
   * Validate agent configuration
   */
  export function validateAgentConfig(config: unknown): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = { valid: true, errors: [] as string[], warnings: [] as string[] };

    try {
      AgentConfigSchema.parse(config);
    } catch (error) {
      result.valid = false;
      if (error instanceof z.ZodError) {
        result.errors = error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`);
      } else {
        result.errors.push(`Validation error: ${error}`);
      }
    }

    return result;
  }

  /**
   * Get agent startup order based on priority and dependencies
   */
  export function getAgentStartupOrder(
    configs: Record<string, AgentConfig>
  ): string[] {
    const agents = Object.entries(configs)
      .filter(([_, config]) => config.enabled && config.autoStart)
      .map(([name, config]) => ({ name, config }));

    // Sort by priority (higher first) and then by startup delay
    agents.sort((a, b) => {
      if (a.config.priority !== b.config.priority) {
        return b.config.priority - a.config.priority;
      }
      return a.config.startupDelay - b.config.startupDelay;
    });

    return agents.map(a => a.name);
  }

  /**
   * Check if agent has required tools available
   */
  export function checkAgentRequirements(
    config: AgentConfig,
    availableTools: string[]
  ): {
    satisfied: boolean;
    missingTools: string[];
    warnings: string[];
  } {
    const missingTools: string[] = [];
    const warnings: string[] = [];

    // Check required tools
    if (config.requiredTools) {
      for (const tool of config.requiredTools) {
        if (!availableTools.includes(tool)) {
          missingTools.push(tool);
        }
      }
    }

    // Check optional tools
    if (config.optionalTools) {
      for (const tool of config.optionalTools) {
        if (!availableTools.includes(tool)) {
          warnings.push(`Optional tool not available: ${tool}`);
        }
      }
    }

    return {
      satisfied: missingTools.length === 0,
      missingTools,
      warnings,
    };
  }

  /**
   * Create agent configuration from template
   */
  export function createAgentFromTemplate(
    name: string,
    template: keyof typeof DEFAULT_AGENTS,
    overrides: Partial<AgentConfig> = {}
  ): AgentConfig {
    const baseConfig = DEFAULT_AGENTS[template];
    if (!baseConfig) {
      throw new AgentConfigError({
        agentName: name,
        message: `Unknown agent template: ${template}`,
      });
    }

    const config = mergeAgentConfigs(baseConfig, { name, ...overrides });
    return AgentConfigSchema.parse(config);
  }

  /**
   * Export agent configuration for external tools
   */
  export function exportAgentConfig(config: AgentConfig): Record<string, any> {
    return {
      name: config.name,
      description: config.description,
      model: config.model,
      tools: config.tools,
      permissions: config.permissions,
      priority: config.priority,
      enabled: config.enabled,
      securityLevel: config.securityLevel,
      privacyMode: config.privacyMode,
    };
  }

  /**
   * Load agent configurations from multiple sources
   */
  export async function loadAgentConfigs(
    sources: Array<{ type: "file" | "object"; data: string | Record<string, any> }>
  ): Promise<Record<string, AgentConfig>> {
    const configs: Record<string, Partial<AgentConfig>> = {};

    // Start with default agents
    Object.assign(configs, DEFAULT_AGENTS);

    // Load from sources
    for (const source of sources) {
      try {
        let sourceConfigs: Record<string, any>;

        if (source.type === "file") {
          const content = await Bun.file(source.data as string).text();
          sourceConfigs = JSON.parse(content);
        } else {
          sourceConfigs = source.data as Record<string, any>;
        }

        // Merge source configurations
        for (const [name, config] of Object.entries(sourceConfigs)) {
          if (configs[name]) {
            configs[name] = mergeAgentConfigs(configs[name], config);
          } else {
            configs[name] = config;
          }
        }
      } catch (error) {
        log.warn("Failed to load agent configuration source", { source, error });
      }
    }

    // Resolve inheritance and validate
    const resolvedConfigs: Record<string, AgentConfig> = {};
    for (const [name, config] of Object.entries(configs)) {
      try {
        resolvedConfigs[name] = resolveAgentConfig(name, configs);
      } catch (error) {
        log.error("Failed to resolve agent configuration", { name, error });
      }
    }

    return resolvedConfigs;
  }

  // Error types
  export const AgentConfigError = NamedError.create(
    "AgentConfigError",
    z.object({
      agentName: z.string(),
      message: z.string(),
      code: z.enum(["INVALID_CONFIG", "CIRCULAR_INHERITANCE", "MISSING_REQUIREMENTS"]).optional(),
    })
  );
}