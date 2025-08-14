import z from "zod";
import { InvalidTool } from "./invalid";
import { BashTool } from "./bash";
import { EditTool } from "./edit";
import { GlobTool } from "./glob";
import { GrepTool } from "./grep";
import { ListTool } from "./ls";
import { PatchTool } from "./patch";
import { ReadTool } from "./read";
import { TaskTool } from "./task";
import { TodoWriteTool, TodoReadTool } from "./todo";
import { WebFetchTool } from "./webfetch";
import { WriteTool } from "./write";
import { MemoryTool } from "./memory";
import { PluginInfoTool } from "./plugin-info";
import { SmartLearningAssistantTool } from "./smart-learning-assistant";
import { IntelligentRuleOptimizerTool } from "./intelligent-rule-optimizer";
import { isToolCompatible, getRecommendedBatchSize } from "../session/model-config";
import { Wildcard } from "../util/wildcard";

/**
 * Tool Registry - Internal Management System
 *
 * This module manages the registration and configuration of user-facing tools.
 * It defines which tools are available to AI agents and handles provider-specific
 * tool configurations.
 *
 * This is an internal management system and does not need a .txt description file
 * because it's not a user-facing tool that AI agents can call directly.
 */
export namespace ToolRegistry {
  const ALL = [
    InvalidTool, // Add at beginning for error handling priority
    BashTool,
    EditTool,
    WebFetchTool,
    GlobTool,
    GrepTool,
    IntelligentRuleOptimizerTool,
    ListTool,
    MemoryTool,
    PatchTool,
    PluginInfoTool,
    ReadTool,
    SmartLearningAssistantTool,
    WriteTool,
    TodoWriteTool,
    TodoReadTool,
    TaskTool,
  ];

  // Enhanced agent-specific tool configurations with wildcard pattern support
  const AGENT_TOOL_CONFIG: Record<string, { 
    allowed?: string[]; 
    denied?: string[];
    patterns?: {
      include?: string[];
      exclude?: string[];
      priority?: "specificity" | "order" | "length";
    };
  }> = {
    grounding: {
      allowed: ["webfetch", "read", "grep", "bash", "memory"],
      patterns: {
        include: ["*fetch*", "read*", "*grep*", "bash*", "memory*"],
        priority: "specificity"
      }
    },
    "code-reviewer": {
      allowed: ["read", "bash", "grep", "memory"],
      patterns: {
        include: ["read*", "bash*", "*grep*", "memory*"],
        exclude: ["write*", "edit*"],
        priority: "specificity"
      }
    },
    documentation: {
      allowed: ["read", "write", "edit", "glob", "grep", "memory"],
      patterns: {
        include: ["read*", "write*", "edit*", "*glob*", "*grep*", "memory*"],
        priority: "specificity"
      }
    },
    testing: {
      allowed: ["read", "write", "edit", "bash", "grep", "glob"],
      patterns: {
        include: ["read*", "write*", "edit*", "bash*", "*grep*", "*glob*"],
        exclude: ["webfetch*"],
        priority: "specificity"
      }
    },
    debugger: {
      allowed: ["read", "bash", "grep", "glob", "memory"],
      patterns: {
        include: ["read*", "bash*", "*grep*", "*glob*", "memory*"],
        exclude: ["write*", "edit*"],
        priority: "specificity"
      }
    },
    architect: {
      allowed: ["read", "write", "grep", "glob", "memory", "todowrite"],
      patterns: {
        include: ["read*", "write*", "*grep*", "*glob*", "memory*", "todo*"],
        priority: "specificity"
      }
    },
    bugfinder: {
      allowed: ["bash", "read", "write", "edit", "grep", "glob"],
      patterns: {
        include: ["bash*", "read*", "write*", "edit*", "*grep*", "*glob*"],
        priority: "specificity"
      }
    },
  };

  /**
   * Enhanced tool filtering with wildcard pattern support
   * Supports both exact tool names and wildcard patterns for flexible configuration
   */
  function filterToolsForAgent(tools: any[], agentName?: string): any[] {
    if (!agentName || !AGENT_TOOL_CONFIG[agentName]) {
      return tools;
    }

    const config = AGENT_TOOL_CONFIG[agentName];
    const toolIds = tools.map(tool => tool.id);
    
    // Use pattern-based filtering if patterns are configured
    if (config.patterns) {
      const includePatterns = config.patterns.include || [];
      const excludePatterns = config.patterns.exclude || [];
      
      const filteredIds = Wildcard.filterToolNames(toolIds, includePatterns, excludePatterns);
      return tools.filter(tool => filteredIds.includes(tool.id));
    }
    
    // Fallback to legacy exact matching
    if (config.allowed) {
      return tools.filter(tool => config.allowed!.includes(tool.id));
    }
    
    if (config.denied) {
      return tools.filter(tool => !config.denied!.includes(tool.id));
    }
    
    return tools;
  }

  /**
   * Get tool configuration priority for a specific agent and tool
   * Used for resolving conflicts when multiple configurations apply
   */
  export function getToolPriority(toolName: string, agentName?: string): number {
    if (!agentName || !AGENT_TOOL_CONFIG[agentName]) {
      return 0;
    }

    const config = AGENT_TOOL_CONFIG[agentName];
    
    // Check pattern-based configuration
    if (config.patterns?.include) {
      const configPatterns: Record<string, number> = {};
      config.patterns.include.forEach((pattern, index) => {
        configPatterns[pattern] = 100 - index; // Higher priority for earlier patterns
      });
      
      return Wildcard.getToolConfigPriority(toolName, configPatterns);
    }
    
    // Check exact match configuration
    if (config.allowed?.includes(toolName)) {
      return 50; // Medium priority for exact matches
    }
    
    return 0;
  }

  /**
   * Check if a tool is allowed for a specific agent using enhanced pattern matching
   */
  export function isToolAllowedForAgent(toolName: string, agentName?: string): boolean {
    if (!agentName || !AGENT_TOOL_CONFIG[agentName]) {
      return true; // Allow all tools if no agent-specific config
    }

    const config = AGENT_TOOL_CONFIG[agentName];
    
    // Check pattern-based configuration
    if (config.patterns) {
      const includePatterns = config.patterns.include || [];
      const excludePatterns = config.patterns.exclude || [];
      
      const filteredTools = Wildcard.filterToolNames([toolName], includePatterns, excludePatterns);
      return filteredTools.length > 0;
    }
    
    // Fallback to legacy exact matching
    if (config.allowed) {
      return config.allowed.includes(toolName);
    }
    
    if (config.denied) {
      return !config.denied.includes(toolName);
    }
    
    return true;
  }

  export function ids() {
    return ALL.map((t) => t.id);
  }

  export async function tools(providerID: string, modelID: string, agentName?: string) {
    const result = await Promise.all(
      ALL.map(async (t) => ({
        id: t.id,
        ...(await t.init()),
      })),
    );

    // Apply agent-specific tool filtering
    let filteredResult = filterToolsForAgent(result, agentName);
    
    // Apply model-specific compatibility filtering
    filteredResult = filteredResult.filter(tool => 
      isToolCompatible(tool.id, modelID, providerID)
    );

    if (providerID === "openai") {
      return filteredResult.map((t) => ({
        ...t,
        parameters: optionalToNullable(t.parameters),
      }));
    }

    if (providerID === "azure") {
      return filteredResult.map((t) => ({
        ...t,
        parameters: optionalToNullable(t.parameters),
      }));
    }

    if (providerID === "google") {
      return filteredResult.map((t) => ({
        ...t,
        parameters: sanitizeGeminiParameters(t.parameters),
      }));
    }

    return filteredResult;
  }

  export function enabled(
    providerID: string,
    modelID: string,
  ): Record<string, boolean> {
    const model = modelID.toLowerCase();
    const provider = providerID.toLowerCase();
    
    // Claude models - disable patch tool due to compatibility issues
    if (model.includes("claude")) {
      return {
        patch: false,
      };
    }
    
    // Qwen models - disable complex tools that may cause issues
    if (model.includes("qwen")) {
      return {
        patch: false,
        todowrite: false,
        todoread: false,
        task: false, // Disable task tool for qwen models
      };
    }
    
    // GPT-5 and Copilot models - enable all advanced tools
    if (model.includes("gpt-5") || model.includes("copilot")) {
      return {
        // All tools enabled by default
      };
    }
    
    // O1 reasoning models - optimize for reasoning tasks
    if (model.includes("o1") || model.includes("o3")) {
      return {
        // All tools enabled, optimized for reasoning
      };
    }
    
    // Google models optimizations (check provider first)
    if (provider === "google" || model.includes("gemini")) {
      return {
        patch: false,
        task: false, // Google models may have issues with complex task tool
      };
    }
    
    // OpenAI models general optimizations
    if (provider === "openai") {
      return {
        // OpenAI models generally work well with all tools
      };
    }
    
    // Anthropic models optimizations
    if (provider === "anthropic") {
      return {
        patch: false, // Anthropic models prefer direct edit operations
      };
    }
    
    return {};
  }

  function sanitizeGeminiParameters(
    schema: z.ZodTypeAny,
    visited = new Set(),
  ): z.ZodTypeAny {
    if (!schema || visited.has(schema)) {
      return schema;
    }
    visited.add(schema);

    if (schema instanceof z.ZodDefault) {
      const innerSchema = schema.removeDefault();
      // Handle Gemini's incompatibility with `default` on `anyOf` (unions).
      if (innerSchema instanceof z.ZodUnion) {
        // The schema was `z.union(...).default(...)`, which is not allowed.
        // We strip the default and return the sanitized union.
        return sanitizeGeminiParameters(innerSchema, visited);
      }
      // Otherwise, the default is on a regular type, which is allowed.
      // We recurse on the inner type and then re-apply the default.
      return sanitizeGeminiParameters(innerSchema, visited).default(
        schema._def.defaultValue(),
      );
    }

    if (schema instanceof z.ZodOptional) {
      return z.optional(sanitizeGeminiParameters(schema.unwrap(), visited));
    }

    if (schema instanceof z.ZodObject) {
      const newShape: Record<string, z.ZodTypeAny> = {};
      for (const [key, value] of Object.entries(schema.shape)) {
        newShape[key] = sanitizeGeminiParameters(
          value as z.ZodTypeAny,
          visited,
        );
      }
      return z.object(newShape);
    }

    if (schema instanceof z.ZodArray) {
      return z.array(sanitizeGeminiParameters(schema.element, visited));
    }

    if (schema instanceof z.ZodUnion) {
      // This schema corresponds to `anyOf` in JSON Schema.
      // We recursively sanitize each option in the union.
      const sanitizedOptions = schema.options.map((option: z.ZodTypeAny) =>
        sanitizeGeminiParameters(option, visited),
      );
      return z.union(
        sanitizedOptions as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
      );
    }

    if (schema instanceof z.ZodString) {
      const newSchema = z.string({ description: schema.description });
      const safeChecks = [
        "min",
        "max",
        "length",
        "regex",
        "startsWith",
        "endsWith",
        "includes",
        "trim",
      ];
      // rome-ignore lint/suspicious/noExplicitAny: <explanation>
      (newSchema._def as any).checks = (
        schema._def as z.ZodStringDef
      ).checks.filter((check) => safeChecks.includes(check.kind));
      return newSchema;
    }

    return schema;
  }

  function optionalToNullable(schema: z.ZodTypeAny): z.ZodTypeAny {
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const newShape: Record<string, z.ZodTypeAny> = {};

      for (const [key, value] of Object.entries(shape)) {
        const zodValue = value as z.ZodTypeAny;
        if (zodValue instanceof z.ZodOptional) {
          newShape[key] = zodValue.unwrap().nullable();
        } else {
          newShape[key] = optionalToNullable(zodValue);
        }
      }

      return z.object(newShape);
    }

    if (schema instanceof z.ZodArray) {
      return z.array(optionalToNullable(schema.element));
    }

    if (schema instanceof z.ZodUnion) {
      return z.union(
        schema.options.map((option: z.ZodTypeAny) =>
          optionalToNullable(option),
        ) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
      );
    }

    return schema;
  }
}
