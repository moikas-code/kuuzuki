import { z } from "zod"
import { NamedError } from "../util/error"

export namespace ConfigSchema {
  // Configuration version for migration support
  export const CONFIG_VERSION = "1.0.0"
  export const SCHEMA_URL = "https://kuuzuki.ai/config.json"

  // Environment variable mapping
  export const ENV_MAPPINGS = {
    // API Keys
    ANTHROPIC_API_KEY: "provider.anthropic.options.apiKey",
    CLAUDE_API_KEY: "provider.anthropic.options.apiKey",
    OPENAI_API_KEY: "provider.openai.options.apiKey",
    OPENROUTER_API_KEY: "provider.openrouter.options.apiKey",
    GITHUB_TOKEN: "provider.github.options.apiKey",
    COPILOT_API_KEY: "provider.copilot.options.apiKey",
    AWS_ACCESS_KEY_ID: "provider.bedrock.options.accessKeyId",
    AWS_SECRET_ACCESS_KEY: "provider.bedrock.options.secretAccessKey",
    AWS_BEARER_TOKEN_BEDROCK: "provider.bedrock.options.bearerToken",

    // General settings
    KUUZUKI_MODEL: "model",
    KUUZUKI_SMALL_MODEL: "small_model",
    KUUZUKI_USERNAME: "username",
    KUUZUKI_THEME: "theme",
    KUUZUKI_API_URL: "apiUrl",
    KUUZUKI_SHARE: "share",
    KUUZUKI_AUTOUPDATE: "autoupdate",

    // Feature flags
    KUUZUKI_SUBSCRIPTION_REQUIRED: "subscriptionRequired",
    KUUZUKI_DISABLED_PROVIDERS: "disabled_providers",
  } as const

  // Default configuration values
  export const DEFAULTS = {
    $schema: SCHEMA_URL,
    version: CONFIG_VERSION,
    theme: "default",
    share: "manual" as const,
    subscriptionRequired: true,
    autoupdate: true,
    disabled_providers: [],
    keybinds: {
      leader: "ctrl+x",
      app_help: "<leader>h",
      switch_mode: "tab",
      switch_mode_reverse: "shift+tab",
      editor_open: "<leader>e",
      session_export: "<leader>x",
      session_new: "<leader>n",
      session_list: "<leader>l",
      session_share: "<leader>s",
      session_unshare: "none",
      session_interrupt: "esc",
      session_compact: "<leader>c",
      tool_details: "<leader>d",
      model_list: "<leader>m",
      theme_list: "<leader>t",
      file_list: "<leader>f",
      file_close: "esc",
      file_search: "<leader>/",
      file_diff_toggle: "<leader>v",
      project_init: "<leader>i",
      input_clear: "ctrl+c",
      input_paste: "ctrl+v",
      input_submit: "enter",
      input_newline: "shift+enter,ctrl+j",
      messages_page_up: "pgup",
      messages_page_down: "pgdown",
      messages_half_page_up: "ctrl+alt+u",
      messages_half_page_down: "ctrl+alt+d",
      messages_previous: "ctrl+up",
      messages_next: "ctrl+down",
      messages_first: "ctrl+g",
      messages_last: "ctrl+alt+g",
      messages_layout_toggle: "<leader>p",
      messages_copy: "<leader>y",
      messages_undo: "<leader>u",
      messages_redo: "<leader>r",
      app_exit: "ctrl+c,<leader>q",
    },
    layout: "stretch" as const,
    experimental: {},
  } as const

  // MCP Server Configuration
  export const McpLocal = z
    .object({
      type: z.literal("local").describe("Type of MCP server connection"),
      command: z.string().array().min(1).describe("Command and arguments to run the MCP server"),
      environment: z
        .record(z.string(), z.string())
        .optional()
        .describe("Environment variables to set when running the MCP server"),
      enabled: z.boolean().default(true).describe("Enable or disable the MCP server on startup"),
      timeout: z.number().min(1000).max(300000).default(30000).describe("Connection timeout in milliseconds"),
      retries: z.number().min(0).max(10).default(3).describe("Number of connection retries"),
    })
    .strict()
    

  export const McpRemote = z
    .object({
      type: z.literal("remote").describe("Type of MCP server connection"),
      url: z.string().url().describe("URL of the remote MCP server"),
      enabled: z.boolean().default(true).describe("Enable or disable the MCP server on startup"),
      headers: z.record(z.string(), z.string()).optional().describe("Headers to send with the request"),
      timeout: z.number().min(1000).max(300000).default(30000).describe("Connection timeout in milliseconds"),
      retries: z.number().min(0).max(10).default(3).describe("Number of connection retries"),
      auth: z
        .object({
          type: z.enum(["bearer", "basic", "apikey"]),
          token: z.string().optional(),
          username: z.string().optional(),
          password: z.string().optional(),
          header: z.string().optional(),
        })
        .optional()
        .describe("Authentication configuration"),
    })
    .strict()
    

  export const Mcp = z.discriminatedUnion("type", [McpLocal, McpRemote])
  export type Mcp = z.infer<typeof Mcp>

  // Mode Configuration
  export const Mode = z
    .object({
      model: z.string().optional().describe("Model to use for this mode"),
      temperature: z.number().min(0).max(2).optional().describe("Temperature setting for model responses"),
      prompt: z.string().optional().describe("Custom prompt for this mode"),
      tools: z.record(z.string(), z.boolean()).optional().describe("Tool availability configuration"),
      disable: z.boolean().optional().describe("Disable this mode"),
      maxTokens: z.number().min(1).max(200000).optional().describe("Maximum tokens for responses"),
      systemPrompt: z.string().optional().describe("System prompt override"),
    })
    .strict()
    
  export type Mode = z.infer<typeof Mode>

  // Agent Configuration
  export const Agent = Mode.extend({
    description: z.string().describe("Description of the agent's purpose"),
    version: z.string().optional().describe("Agent version"),
    author: z.string().optional().describe("Agent author"),
    tags: z.array(z.string()).optional().describe("Agent tags for categorization"),
  })
    .strict()
    
  export type Agent = z.infer<typeof Agent>

  // Keybinds Configuration
  export const Keybinds = z
    .object({
      leader: z.string().default(DEFAULTS.keybinds.leader).describe("Leader key for keybind combinations"),
      app_help: z.string().default(DEFAULTS.keybinds.app_help).describe("Show help dialog"),
      switch_mode: z.string().default(DEFAULTS.keybinds.switch_mode).describe("Next mode"),
      switch_mode_reverse: z.string().default(DEFAULTS.keybinds.switch_mode_reverse).describe("Previous Mode"),
      editor_open: z.string().default(DEFAULTS.keybinds.editor_open).describe("Open external editor"),
      session_export: z.string().default(DEFAULTS.keybinds.session_export).describe("Export session to editor"),
      session_new: z.string().default(DEFAULTS.keybinds.session_new).describe("Create a new session"),
      session_list: z.string().default(DEFAULTS.keybinds.session_list).describe("List all sessions"),
      session_share: z.string().default(DEFAULTS.keybinds.session_share).describe("Share current session"),
      session_unshare: z.string().default(DEFAULTS.keybinds.session_unshare).describe("Unshare current session"),
      session_interrupt: z.string().default(DEFAULTS.keybinds.session_interrupt).describe("Interrupt current session"),
      session_compact: z.string().default(DEFAULTS.keybinds.session_compact).describe("Compact the session"),
      tool_details: z.string().default(DEFAULTS.keybinds.tool_details).describe("Toggle tool details"),
      model_list: z.string().default(DEFAULTS.keybinds.model_list).describe("List available models"),
      theme_list: z.string().default(DEFAULTS.keybinds.theme_list).describe("List available themes"),
      file_list: z.string().default(DEFAULTS.keybinds.file_list).describe("List files"),
      file_close: z.string().default(DEFAULTS.keybinds.file_close).describe("Close file"),
      file_search: z.string().default(DEFAULTS.keybinds.file_search).describe("Search file"),
      file_diff_toggle: z.string().default(DEFAULTS.keybinds.file_diff_toggle).describe("Split/unified diff"),
      project_init: z.string().default(DEFAULTS.keybinds.project_init).describe("Create/update AGENTS.md"),
      input_clear: z.string().default(DEFAULTS.keybinds.input_clear).describe("Clear input field"),
      input_paste: z.string().default(DEFAULTS.keybinds.input_paste).describe("Paste from clipboard"),
      input_submit: z.string().default(DEFAULTS.keybinds.input_submit).describe("Submit input"),
      input_newline: z.string().default(DEFAULTS.keybinds.input_newline).describe("Insert newline in input"),
      messages_page_up: z
        .string()
        .default(DEFAULTS.keybinds.messages_page_up)
        .describe("Scroll messages up by one page"),
      messages_page_down: z
        .string()
        .default(DEFAULTS.keybinds.messages_page_down)
        .describe("Scroll messages down by one page"),
      messages_half_page_up: z
        .string()
        .default(DEFAULTS.keybinds.messages_half_page_up)
        .describe("Scroll messages up by half page"),
      messages_half_page_down: z
        .string()
        .default(DEFAULTS.keybinds.messages_half_page_down)
        .describe("Scroll messages down by half page"),
      messages_previous: z
        .string()
        .default(DEFAULTS.keybinds.messages_previous)
        .describe("Navigate to previous message"),
      messages_next: z.string().default(DEFAULTS.keybinds.messages_next).describe("Navigate to next message"),
      messages_first: z.string().default(DEFAULTS.keybinds.messages_first).describe("Navigate to first message"),
      messages_last: z.string().default(DEFAULTS.keybinds.messages_last).describe("Navigate to last message"),
      messages_layout_toggle: z.string().default(DEFAULTS.keybinds.messages_layout_toggle).describe("Toggle layout"),
      messages_copy: z.string().default(DEFAULTS.keybinds.messages_copy).describe("Copy message"),
      messages_revert: z.string().default("none").describe("@deprecated use messages_undo. Revert message"),
      messages_undo: z.string().default(DEFAULTS.keybinds.messages_undo).describe("Undo message"),
      messages_redo: z.string().default(DEFAULTS.keybinds.messages_redo).describe("Redo message"),
      app_exit: z.string().default(DEFAULTS.keybinds.app_exit).describe("Exit the application"),
    })
    .strict()
    
  export type Keybinds = z.infer<typeof Keybinds>

  // Layout Configuration
  export const Layout = z.enum(["auto", "stretch"]).default("stretch")
  export type Layout = z.infer<typeof Layout>

  // Share Configuration
  export const Share = z.enum(["manual", "auto", "disabled"]).default("manual")
  export type Share = z.infer<typeof Share>

  // Provider Configuration
  export const ProviderOptions = z
    .object({
      apiKey: z.string().optional().describe("API key for the provider"),
      baseURL: z.string().url().optional().describe("Base URL for the provider API"),
      timeout: z.number().min(1000).max(300000).optional().describe("Request timeout in milliseconds"),
      retries: z.number().min(0).max(10).optional().describe("Number of request retries"),
      rateLimit: z
        .object({
          requests: z.number().min(1).describe("Number of requests"),
          window: z.number().min(1000).describe("Time window in milliseconds"),
        })
        .optional()
        .describe("Rate limiting configuration"),
    })
    .catchall(z.any())
    .strict()
    

  export const ModelConfig = z
    .object({
      name: z.string().describe("Model name"),
      displayName: z.string().optional().describe("Display name for the model"),
      description: z.string().optional().describe("Model description"),
      maxTokens: z.number().min(1).max(200000).optional().describe("Maximum tokens supported"),
      contextWindow: z.number().min(1).max(2000000).optional().describe("Context window size"),
      pricing: z
        .object({
          input: z.number().min(0).describe("Input token price per 1K tokens"),
          output: z.number().min(0).describe("Output token price per 1K tokens"),
        })
        .optional()
        .describe("Pricing information"),
      capabilities: z
        .array(z.enum(["text", "vision", "function_calling", "streaming"]))
        .optional()
        .describe("Model capabilities"),
      deprecated: z.boolean().optional().describe("Whether the model is deprecated"),
    })
    .strict()
    

  export const ProviderConfig = z
    .object({
      name: z.string().describe("Provider name"),
      displayName: z.string().optional().describe("Display name for the provider"),
      description: z.string().optional().describe("Provider description"),
      enabled: z.boolean().default(true).describe("Whether the provider is enabled"),
      models: z.record(z.string(), ModelConfig.partial()).optional().describe("Model configurations"),
      options: ProviderOptions.optional().describe("Provider-specific options"),
      priority: z.number().min(0).max(100).default(50).describe("Provider priority for model selection"),
    })
    .strict()
    

  // Experimental Features
  export const HookConfig = z
    .object({
      command: z.string().array().min(1).describe("Command to execute"),
      environment: z.record(z.string(), z.string()).optional().describe("Environment variables"),
      timeout: z.number().min(1000).max(300000).default(30000).describe("Execution timeout"),
      workingDirectory: z.string().optional().describe("Working directory for command execution"),
      onError: z.enum(["ignore", "warn", "fail"]).default("warn").describe("Error handling strategy"),
    })
    .strict()
    

  export const ExperimentalConfig = z
    .object({
      hook: z
        .object({
          file_edited: z.record(z.string(), HookConfig.array()).optional().describe("Hooks for file edit events"),
          session_completed: HookConfig.array().optional().describe("Hooks for session completion"),
          session_started: HookConfig.array().optional().describe("Hooks for session start"),
          model_switched: HookConfig.array().optional().describe("Hooks for model switching"),
        })
        .optional()
        .describe("Event hook configurations"),
      features: z
        .object({
          hybridContext: z.boolean().default(false).describe("Enable hybrid context management"),
          taskAwareCompression: z.boolean().default(false).describe("Enable task-aware compression"),
          semanticSearch: z.boolean().default(false).describe("Enable semantic search capabilities"),
          advancedGitIntegration: z.boolean().default(false).describe("Enable advanced git integration"),
          multiModelSupport: z.boolean().default(false).describe("Enable multi-model support"),
        })
        .optional()
        .describe("Experimental feature flags"),
      performance: z
        .object({
          cacheSize: z.number().min(1).max(1000).default(100).describe("Cache size in MB"),
          maxConcurrentRequests: z.number().min(1).max(50).default(10).describe("Maximum concurrent requests"),
          requestBatching: z.boolean().default(false).describe("Enable request batching"),
          lazyLoading: z.boolean().default(true).describe("Enable lazy loading of components"),
        })
        .optional()
        .describe("Performance optimization settings"),
    })
    .strict()
    

  // Main Configuration Schema
  export const Config = z
    .object({
      // Metadata
      $schema: z.string().default(SCHEMA_URL).describe("JSON schema reference for configuration validation"),
      version: z.string().default(CONFIG_VERSION).describe("Configuration version for migration support"),

      // Core Settings
      theme: z.string().default(DEFAULTS.theme).describe("Theme name to use for the interface"),
      username: z
        .string()
        .optional()
        .describe("Custom username to display in conversations instead of system username"),
      model: z
        .string()
        .optional()
        .describe("Default model to use in the format of provider/model, eg anthropic/claude-3-5-sonnet"),
      small_model: z
        .string()
        .optional()
        .describe("Small model to use for tasks like summarization and title generation"),

      // Feature Configuration
      share: Share.describe(
        "Control sharing behavior: 'manual' allows manual sharing via commands, 'auto' enables automatic sharing, 'disabled' disables all sharing",
      ),
      subscriptionRequired: z
        .boolean()
        .default(DEFAULTS.subscriptionRequired)
        .describe("Require subscription for share features"),
      autoupdate: z.boolean().default(DEFAULTS.autoupdate).describe("Automatically update to the latest version"),

      // API Configuration
      apiUrl: z.string().url().optional().describe("Custom API URL for self-hosted instances"),
      disabled_providers: z.array(z.string()).default([]).describe("Disable providers that are loaded automatically"),

      // UI Configuration
      keybinds: Keybinds.default(DEFAULTS.keybinds).describe("Custom keybind configurations"),
      layout: Layout.describe("Layout configuration for the interface"),

      // Advanced Configuration
      mode: z
        .object({
          build: Mode.optional().describe("Build mode configuration"),
          plan: Mode.optional().describe("Plan mode configuration"),
        })
        .catchall(Mode)
        .optional()
        .describe("Mode configurations, see https://kuuzuki.ai/docs/modes"),

      agent: z
        .object({
          general: Agent.optional().describe("General agent configuration"),
        })
        .catchall(Agent)
        .optional()
        .describe("Agent configurations, see https://kuuzuki.ai/docs/agents"),

      provider: z
        .record(z.string(), ProviderConfig.partial())
        .optional()
        .describe("Custom provider configurations and model overrides"),

      mcp: z.record(z.string(), Mcp).optional().describe("MCP (Model Context Protocol) server configurations"),

      instructions: z.array(z.string()).optional().describe("Additional instruction files or patterns to include"),

      experimental: ExperimentalConfig.optional().describe("Experimental features and configurations"),

      // Deprecated fields (for backward compatibility)
      autoshare: z
        .boolean()
        .optional()
        .describe("@deprecated Use 'share' field instead. Share newly created sessions automatically"),
    })
    .strict()
    

  export type Config = z.infer<typeof Config>
  export type ConfigInput = z.input<typeof Config>
  export type ConfigOutput = z.output<typeof Config>

  // Validation Errors
  export const ValidationError = NamedError.create(
    "ConfigValidationError",
    z.object({
      path: z.string(),
      issues: z.array(z.any()),
      source: z.enum(["file", "environment", "merge"]),
    }),
  )

  export const MigrationError = NamedError.create(
    "ConfigMigrationError",
    z.object({
      fromVersion: z.string(),
      toVersion: z.string(),
      path: z.string(),
      reason: z.string(),
    }),
  )

  export const BackupError = NamedError.create(
    "ConfigBackupError",
    z.object({
      path: z.string(),
      operation: z.enum(["create", "restore", "cleanup"]),
      reason: z.string(),
    }),
  )

  // Utility functions for schema validation
  export function validateConfig(data: unknown, source = "unknown"): ConfigOutput {
    const result = Config.safeParse(data)
    if (!result.success) {
      throw new ValidationError({
        path: source,
        issues: result.error.issues,
        source: "file",
      })
    }
    return result.data
  }

  export function validatePartialConfig(data: unknown, source = "unknown"): Partial<ConfigOutput> {
    const result = Config.partial().safeParse(data)
    if (!result.success) {
      throw new ValidationError({
        path: source,
        issues: result.error.issues,
        source: "file",
      })
    }
    return result.data
  }

  export function getDefaultConfig(): ConfigOutput {
    return Config.parse({})
  }

  // Environment variable parsing
  export function parseEnvironmentVariables(): Partial<ConfigInput> {
    const config: any = {}

    for (const [envVar, configPath] of Object.entries(ENV_MAPPINGS)) {
      const value = process.env[envVar]
      if (value !== undefined) {
        setNestedValue(config, configPath, parseEnvValue(value))
      }
    }

    return config
  }

  function setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split(".")
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current)) {
        current[key] = {}
      }
      current = current[key]
    }

    current[keys[keys.length - 1]] = value
  }

  function parseEnvValue(value: string): any {
    // Try to parse as JSON first
    try {
      return JSON.parse(value)
    } catch {
      // If not JSON, return as string
      return value
    }
  }
}
