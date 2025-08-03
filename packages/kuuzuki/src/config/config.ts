import { Log } from "../util/log";
import path from "path";
import { z } from "zod";
import { App } from "../app/app";
import { Filesystem } from "../util/filesystem";
import { ModelsDev } from "../provider/models";
import { mergeDeep } from "remeda";
import { Global } from "../global";
import fs from "fs/promises";
import { lazy } from "../util/lazy";
import { NamedError } from "../util/error";
import matter from "gray-matter";
import { ApiKeyManager } from "../auth/apikey";
import { ConfigSchema } from "./schema";
import { ConfigMigration } from "./migration";
import { parseAgentrc, mergeAgentrcMcpWithConfig } from "./agentrc";
import { Auth } from "../auth";

export namespace Config {
  const log = Log.create({ service: "config" });

  export const state = App.state("config", async (app) => {
    // Load base configuration
    let result = await global();

    // Merge environment variables
    const envConfig = ConfigSchema.parseEnvironmentVariables();
    result = mergeDeep(result, envConfig);

    // Load project-specific configurations
    for (const file of ["kuuzuki.jsonc", "kuuzuki.json"]) {
      const found = await Filesystem.findUp(file, app.path.cwd, app.path.root);
      for (const resolved of found.toReversed()) {
        const projectConfig = await load(resolved);
        result = mergeDeep(result, projectConfig);
      }
    }

    // Load and merge .agentrc configurations
    const agentrcFiles = await Filesystem.findUp(
      ".agentrc",
      app.path.cwd,
      app.path.root,
    );
    for (const agentrcPath of agentrcFiles.toReversed()) {
      try {
        const agentrcContent = await Bun.file(agentrcPath).text();
        const agentrcConfig = parseAgentrc(agentrcContent);

        // Merge MCP configuration from .agentrc
        if (agentrcConfig.mcp) {
          result.mcp = mergeAgentrcMcpWithConfig(agentrcConfig.mcp, result.mcp);
          log.info("Merged MCP configuration from .agentrc", {
            path: agentrcPath,
            servers: Object.keys(agentrcConfig.mcp.servers || {}),
          });
        }
      } catch (error) {
        log.warn("Failed to load .agentrc file", { path: agentrcPath, error });
        // Continue loading other configs even if one .agentrc fails
      }
    }

    // Process well-known auth configurations
    const auth = await Auth.all();
    for (const [key, value] of Object.entries(auth)) {
      if (value.type === "wellknown") {
        process.env[value.key] = value.token;
        const wellknown = await fetch(`${key}/.well-known/opencode`).then((x) =>
          x.json(),
        );
        result = mergeDeep(
          result,
          await loadRaw(JSON.stringify(wellknown.config ?? {}), process.cwd()),
        );
      }
    }

    // Handle configuration migration if needed
    const migrationEngine = new ConfigMigration.MigrationEngine("");
    if (await migrationEngine.needsMigration(result)) {
      log.info("Configuration migration required");
      try {
        const migrationResult = await migrationEngine.migrate(result, {
          createBackup: true,
          dryRun: false,
        });
        result = migrationResult.config;
        if (migrationResult.backupPath) {
          log.info("Configuration backup created", {
            backupPath: migrationResult.backupPath,
          });
        }
      } catch (error) {
        log.error("Configuration migration failed", { error });
        // Continue with unmigrated config but log the issue
      }
    }

    // Load markdown agents
    result.agent = result.agent || {};
    const markdownAgents = [
      ...(await Filesystem.globUp(
        "agent/*.md",
        Global.Path.config,
        Global.Path.config,
      )),
      ...(await Filesystem.globUp(
        ".kuuzuki/agent/*.md",
        app.path.cwd,
        app.path.root,
      )),
    ];
    for (const item of markdownAgents) {
      const content = await Bun.file(item).text();
      const md = matter(content);
      if (!md.data) continue;

      const config = {
        name: path.basename(item, ".md"),
        ...md.data,
        prompt: md.content.trim(),
      };
      const parsed = ConfigSchema.Agent.safeParse(config);
      if (parsed.success) {
        result.agent = mergeDeep(result.agent, {
          [config.name]: parsed.data,
        });
        continue;
      }
      throw new InvalidError({ path: item }, { cause: parsed.error });
    }

    // Set default username if not provided
    if (!result.username) {
      const os = await import("os");
      result.username = os.userInfo().username;
    }

    // Final validation with schema
    try {
      result = ConfigSchema.validateConfig(result, "merged-config");
    } catch (error) {
      log.warn(
        "Configuration validation failed, using defaults where possible",
        { error },
      );
      // Merge with defaults to ensure we have a valid configuration
      const defaults = ConfigSchema.getDefaultConfig();
      result = mergeDeep(defaults, result);
    }

    log.info("Configuration loaded successfully", {
      version: result.version,
      schema: result.$schema,
      providers: Object.keys(result.provider || {}),
      mcpServers: Object.keys(result.mcp || {}),
    });

    return result;
  });

  export const McpLocal = z
    .object({
      type: z.literal("local").describe("Type of MCP server connection"),
      command: z
        .string()
        .array()
        .describe("Command and arguments to run the MCP server"),
      environment: z
        .record(z.string(), z.string())
        .optional()
        .describe("Environment variables to set when running the MCP server"),
      enabled: z
        .boolean()
        .optional()
        .describe("Enable or disable the MCP server on startup"),
    })
    .strict()
    .openapi({
      ref: "McpLocalConfig",
    });

  export const McpRemote = z
    .object({
      type: z.literal("remote").describe("Type of MCP server connection"),
      url: z.string().describe("URL of the remote MCP server"),
      enabled: z
        .boolean()
        .optional()
        .describe("Enable or disable the MCP server on startup"),
      headers: z
        .record(z.string(), z.string())
        .optional()
        .describe("Headers to send with the request"),
    })
    .strict()
    .openapi({
      ref: "McpRemoteConfig",
    });

  export const Mcp = z.discriminatedUnion("type", [McpLocal, McpRemote]);
  export type Mcp = z.infer<typeof Mcp>;

  export const Mode = z
    .object({
      model: z.string().optional(),
      temperature: z.number().optional(),
      prompt: z.string().optional(),
      tools: z.record(z.string(), z.boolean()).optional(),
      disable: z.boolean().optional(),
    })
    .openapi({
      ref: "ModeConfig",
    });
  export type Mode = z.infer<typeof Mode>;

  export const Agent = Mode.extend({
    description: z.string(),
  }).openapi({
    ref: "AgentConfig",
  });

  export const Keybinds = z
    .object({
      leader: z
        .string()
        .optional()
        .default("ctrl+x")
        .describe("Leader key for keybind combinations"),
      app_help: z
        .string()
        .optional()
        .default("<leader>h")
        .describe("Show help dialog"),
      switch_mode: z.string().optional().default("tab").describe("Next mode"),
      switch_mode_reverse: z
        .string()
        .optional()
        .default("shift+tab")
        .describe("Previous Mode"),
      editor_open: z
        .string()
        .optional()
        .default("<leader>e")
        .describe("Open external editor"),
      session_export: z
        .string()
        .optional()
        .default("<leader>x")
        .describe("Export session to editor"),
      session_new: z
        .string()
        .optional()
        .default("<leader>n")
        .describe("Create a new session"),
      session_list: z
        .string()
        .optional()
        .default("<leader>l")
        .describe("List all sessions"),
      session_share: z
        .string()
        .optional()
        .default("<leader>s")
        .describe("Share current session"),
      session_unshare: z
        .string()
        .optional()
        .default("none")
        .describe("Unshare current session"),
      session_interrupt: z
        .string()
        .optional()
        .default("esc")
        .describe("Interrupt current session"),
      session_compact: z
        .string()
        .optional()
        .default("<leader>c")
        .describe("Compact the session"),
      tool_details: z
        .string()
        .optional()
        .default("<leader>d")
        .describe("Toggle tool details"),
      model_list: z
        .string()
        .optional()
        .default("<leader>m")
        .describe("List available models"),
      theme_list: z
        .string()
        .optional()
        .default("<leader>t")
        .describe("List available themes"),
      file_list: z
        .string()
        .optional()
        .default("<leader>f")
        .describe("List files"),
      file_close: z.string().optional().default("esc").describe("Close file"),
      file_search: z
        .string()
        .optional()
        .default("<leader>/")
        .describe("Search file"),
      file_diff_toggle: z
        .string()
        .optional()
        .default("<leader>v")
        .describe("Split/unified diff"),
      project_init: z
        .string()
        .optional()
        .default("<leader>i")
        .describe("Create/update AGENTS.md"),
      input_clear: z
        .string()
        .optional()
        .default("ctrl+c")
        .describe("Clear input field"),
      input_paste: z
        .string()
        .optional()
        .default("ctrl+v")
        .describe("Paste from clipboard"),
      input_submit: z
        .string()
        .optional()
        .default("enter")
        .describe("Submit input"),
      input_newline: z
        .string()
        .optional()
        .default("shift+enter,ctrl+j")
        .describe("Insert newline in input"),
      messages_page_up: z
        .string()
        .optional()
        .default("pgup")
        .describe("Scroll messages up by one page"),
      messages_page_down: z
        .string()
        .optional()
        .default("pgdown")
        .describe("Scroll messages down by one page"),
      messages_half_page_up: z
        .string()
        .optional()
        .default("ctrl+alt+u")
        .describe("Scroll messages up by half page"),
      messages_half_page_down: z
        .string()
        .optional()
        .default("ctrl+alt+d")
        .describe("Scroll messages down by half page"),
      messages_previous: z
        .string()
        .optional()
        .default("ctrl+up")
        .describe("Navigate to previous message"),
      messages_next: z
        .string()
        .optional()
        .default("ctrl+down")
        .describe("Navigate to next message"),
      messages_first: z
        .string()
        .optional()
        .default("ctrl+g")
        .describe("Navigate to first message"),
      messages_last: z
        .string()
        .optional()
        .default("ctrl+alt+g")
        .describe("Navigate to last message"),
      messages_layout_toggle: z
        .string()
        .optional()
        .default("<leader>p")
        .describe("Toggle layout"),
      messages_copy: z
        .string()
        .optional()
        .default("<leader>y")
        .describe("Copy message"),
      messages_revert: z
        .string()
        .optional()
        .default("none")
        .describe("@deprecated use messages_undo. Revert message"),
      messages_undo: z
        .string()
        .optional()
        .default("<leader>u")
        .describe("Undo message"),
      messages_redo: z
        .string()
        .optional()
        .default("<leader>r")
        .describe("Redo message"),
      app_exit: z
        .string()
        .optional()
        .default("ctrl+c,<leader>q")
        .describe("Exit the application"),
    })
    .strict()
    .openapi({
      ref: "KeybindsConfig",
    });

  export const Layout = z.enum(["auto", "stretch"]).openapi({
    ref: "LayoutConfig",
  });
  export type Layout = z.infer<typeof Layout>;

  export const Info = z
    .object({
      $schema: z
        .string()
        .optional()
        .describe("JSON schema reference for configuration validation"),
      theme: z
        .string()
        .optional()
        .describe("Theme name to use for the interface"),
      keybinds: Keybinds.optional().describe("Custom keybind configurations"),
      share: z
        .enum(["manual", "auto", "disabled"])
        .optional()
        .describe(
          "Control sharing behavior:'manual' allows manual sharing via commands, 'auto' enables automatic sharing, 'disabled' disables all sharing",
        ),
      subscriptionRequired: z
        .boolean()
        .optional()
        .describe("Require subscription for share features (default: true)"),
      apiUrl: z
        .string()
        .optional()
        .describe("Custom API URL for self-hosted instances"),
      autoshare: z
        .boolean()
        .optional()
        .describe(
          "@deprecated Use 'share' field instead. Share newly created sessions automatically",
        ),
      autoupdate: z
        .boolean()
        .optional()
        .describe("Automatically update to the latest version"),
      disabled_providers: z
        .array(z.string())
        .optional()
        .describe("Disable providers that are loaded automatically"),
      model: z
        .string()
        .describe(
          "Model to use in the format of provider/model, eg anthropic/claude-2",
        )
        .optional(),
      small_model: z
        .string()
        .describe(
          "Small model to use for tasks like summarization and title generation in the format of provider/model",
        )
        .optional(),
      username: z
        .string()
        .optional()
        .describe(
          "Custom username to display in conversations instead of system username",
        ),
      mode: z
        .object({
          build: Mode.optional(),
          plan: Mode.optional(),
        })
        .catchall(Mode)
        .optional()
        .describe("Modes configuration, see https://kuuzuki.ai/docs/modes"),
      agent: z
        .object({
          general: Agent.optional(),
        })
        .catchall(Agent)
        .optional()
        .describe("Modes configuration, see https://kuuzuki.ai/docs/modes"),
      provider: z
        .record(
          ModelsDev.Provider.partial()
            .extend({
              models: z.record(ModelsDev.Model.partial()),
              options: z
                .object({
                  apiKey: z.string().optional(),
                  baseURL: z.string().optional(),
                })
                .catchall(z.any())
                .optional(),
            })
            .strict(),
        )
        .optional()
        .describe("Custom provider configurations and model overrides"),
      mcp: z
        .record(z.string(), Mcp)
        .optional()
        .describe("MCP (Model Context Protocol) server configurations"),
      instructions: z
        .array(z.string())
        .optional()
        .describe("Additional instruction files or patterns to include"),
      layout: Layout.optional().describe(
        "@deprecated Always uses stretch layout.",
      ),
      experimental: z
        .object({
          hook: z
            .object({
              file_edited: z
                .record(
                  z.string(),
                  z
                    .object({
                      command: z.string().array(),
                      environment: z.record(z.string(), z.string()).optional(),
                    })
                    .array(),
                )
                .optional(),
              session_completed: z
                .object({
                  command: z.string().array(),
                  environment: z.record(z.string(), z.string()).optional(),
                })
                .array()
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .strict()
    .openapi({
      ref: "Config",
    });

  export type Info = ConfigSchema.ConfigOutput;

  export const global = lazy(async () => {
    let result: any = {};

    // Load from standard config files
    const configFiles = [
      path.join(Global.Path.config, "config.json"),
      path.join(Global.Path.config, "kuuzuki.json"),
    ];

    for (const configFile of configFiles) {
      try {
        const config = await load(configFile);
        result = mergeDeep(result, config);
      } catch (error) {
        // Ignore file not found errors
        if (
          error instanceof JsonError &&
          (error.cause as any)?.code === "ENOENT"
        ) {
          continue;
        }
        throw error;
      }
    }

    // Load global .agentrc configuration
    const globalAgentrcPath = path.join(Global.Path.config, ".agentrc");
    try {
      const agentrcContent = await Bun.file(globalAgentrcPath).text();
      const agentrcConfig = parseAgentrc(agentrcContent);

      // Merge MCP configuration from global .agentrc
      if (agentrcConfig.mcp) {
        result.mcp = mergeAgentrcMcpWithConfig(agentrcConfig.mcp, result.mcp);
        log.info("Merged global MCP configuration from .agentrc", {
          path: globalAgentrcPath,
          servers: Object.keys(agentrcConfig.mcp.servers || {}),
        });
      }
    } catch (error) {
      // Ignore if global .agentrc doesn't exist
      if ((error as any)?.code !== "ENOENT") {
        log.warn("Failed to load global .agentrc file", {
          path: globalAgentrcPath,
          error,
        });
      }
    }

    // Handle legacy TOML config migration
    try {
      const tomlConfig = await import(path.join(Global.Path.config, "config"), {
        with: { type: "toml" },
      });

      const { provider, model, ...rest } = tomlConfig.default;
      if (provider && model) {
        result.model = `${provider}/${model}`;
      }

      result = mergeDeep(result, rest);
      result.$schema = ConfigSchema.SCHEMA_URL;
      result.version = ConfigSchema.CONFIG_VERSION;

      // Write migrated config and remove TOML file
      await Bun.write(
        path.join(Global.Path.config, "config.json"),
        JSON.stringify(result, null, 2),
      );
      await fs.unlink(path.join(Global.Path.config, "config"));

      log.info("Migrated legacy TOML configuration to JSON");
    } catch {
      // TOML config doesn't exist, which is fine
    }

    // Ensure we have at least default values
    if (Object.keys(result).length === 0) {
      result = ConfigSchema.getDefaultConfig();
    }

    return result;
  });

  async function load(configPath: string) {
    let text = await Bun.file(configPath)
      .text()
      .catch((err) => {
        if (err.code === "ENOENT") return;
        throw new JsonError({ path: configPath }, { cause: err });
      });
    if (!text) return {};

    text = text.replace(/\{env:([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || "";
    });

    // Handle API key environment variables
    const apiKeyEnvVars = [
      "ANTHROPIC_API_KEY",
      "CLAUDE_API_KEY",
      "OPENAI_API_KEY",
      "OPENROUTER_API_KEY",
      "GITHUB_TOKEN",
      "COPILOT_API_KEY",
      "AWS_ACCESS_KEY_ID",
      "AWS_BEARER_TOKEN_BEDROCK",
    ];

    for (const envVar of apiKeyEnvVars) {
      const value = process.env[envVar];
      if (value) {
        text = text.replace(new RegExp(`\\{env:${envVar}\\}`, "g"), value);
      }
    }

    const fileMatches = text.match(/"?\{file:([^}]+)\}"?/g);
    if (fileMatches) {
      const configDir = path.dirname(configPath);
      for (const match of fileMatches) {
        const filePath = match.replace(/^"?\{file:/, "").replace(/\}"?$/, "");
        const resolvedPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(configDir, filePath);
        const fileContent = await Bun.file(resolvedPath).text();
        text = text.replace(match, JSON.stringify(fileContent));
      }
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new JsonError({ path: configPath }, { cause: err as Error });
    }

    try {
      const validatedData = ConfigSchema.validateConfig(data, configPath);

      // Update schema reference if missing
      if (!validatedData.$schema) {
        validatedData.$schema = ConfigSchema.SCHEMA_URL;
        await Bun.write(configPath, JSON.stringify(validatedData, null, 2));
      }

      return validatedData;
    } catch (error) {
      if (error instanceof ConfigSchema.ValidationError) {
        throw new InvalidError({ path: configPath, issues: error.data.issues });
      }
      throw error;
    }
  }

  async function loadRaw(text: string, configPath: string) {
    text = text.replace(/\{env:([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || "";
    });

    // Handle API key environment variables
    const apiKeyEnvVars = [
      "ANTHROPIC_API_KEY",
      "CLAUDE_API_KEY",
      "OPENAI_API_KEY",
      "OPENROUTER_API_KEY",
      "GITHUB_TOKEN",
      "COPILOT_API_KEY",
      "AWS_ACCESS_KEY_ID",
      "AWS_BEARER_TOKEN_BEDROCK",
    ];

    for (const envVar of apiKeyEnvVars) {
      const value = process.env[envVar];
      if (value) {
        text = text.replace(new RegExp(`\\{env:${envVar}\\}`, "g"), value);
      }
    }

    const fileMatches = text.match(/"?\{file:([^}]+)\}"?/g);
    if (fileMatches) {
      const configDir = path.dirname(configPath);
      for (const match of fileMatches) {
        const filePath = match.replace(/^"?\{file:/, "").replace(/\}"?$/, "");
        const resolvedPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(configDir, filePath);
        const fileContent = await Bun.file(resolvedPath).text();
        text = text.replace(match, JSON.stringify(fileContent));
      }
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new JsonError({ path: configPath }, { cause: err as Error });
    }

    try {
      const validatedData = ConfigSchema.validateConfig(data, configPath);
      return validatedData;
    } catch (error) {
      if (error instanceof ConfigSchema.ValidationError) {
        throw new InvalidError({ path: configPath, issues: error.data.issues });
      }
      throw error;
    }
  }

  export const JsonError = NamedError.create(
    "ConfigJsonError",
    z.object({
      path: z.string(),
    }),
  );

  export const InvalidError = NamedError.create(
    "ConfigInvalidError",
    z.object({
      path: z.string(),
      issues: z.custom<z.ZodIssue[]>().optional(),
    }),
  );

  export function get() {
    return state();
  }

  // Configuration management utilities
  export namespace Management {
    export async function backup(
      configPath: string,
      suffix?: string,
    ): Promise<string> {
      const backupManager = new ConfigMigration.BackupManager(configPath);
      return backupManager.createBackup(suffix);
    }

    export async function restore(
      configPath: string,
      backupPath: string,
    ): Promise<void> {
      const backupManager = new ConfigMigration.BackupManager(configPath);
      return backupManager.restoreBackup(backupPath);
    }

    export async function listBackups(configPath: string): Promise<string[]> {
      const backupManager = new ConfigMigration.BackupManager(configPath);
      return backupManager.listBackups();
    }

    export async function cleanupBackups(
      configPath: string,
      keepCount = 5,
    ): Promise<void> {
      const backupManager = new ConfigMigration.BackupManager(configPath);
      return backupManager.cleanupOldBackups(keepCount);
    }

    export async function migrate(
      configPath: string,
      config: any,
      options?: {
        createBackup?: boolean;
        dryRun?: boolean;
        force?: boolean;
      },
    ): Promise<{ config: any; backupPath?: string }> {
      return ConfigMigration.migrateConfig(configPath, config, options);
    }

    export async function rollback(
      configPath: string,
      config: any,
      targetVersion: string,
      options?: {
        createBackup?: boolean;
        dryRun?: boolean;
      },
    ): Promise<{ config: any; backupPath?: string }> {
      return ConfigMigration.rollbackConfig(
        configPath,
        config,
        targetVersion,
        options,
      );
    }

    export async function validate(
      data: unknown,
      source = "unknown",
    ): Promise<ConfigSchema.ConfigOutput> {
      return ConfigSchema.validateConfig(data, source);
    }

    export function getDefaults(): ConfigSchema.ConfigOutput {
      return ConfigSchema.getDefaultConfig();
    }

    export function mergeConfigs(
      ...configs: Partial<ConfigSchema.ConfigInput>[]
    ): ConfigSchema.ConfigInput {
      return configs.reduce(
        (merged, config) => mergeDeep(merged, config),
        {} as ConfigSchema.ConfigInput,
      );
    }

    export async function writeConfig(
      configPath: string,
      config: ConfigSchema.ConfigOutput,
    ): Promise<void> {
      // Ensure the config is valid before writing
      const validatedConfig = ConfigSchema.validateConfig(config, configPath);

      // Ensure schema is set
      if (!validatedConfig.$schema) {
        validatedConfig.$schema = ConfigSchema.SCHEMA_URL;
      }

      // Write with proper formatting
      await Bun.write(configPath, JSON.stringify(validatedConfig, null, 2));
      log.info("Configuration written successfully", { path: configPath });
    }

    export async function loadFromFile(
      configPath: string,
    ): Promise<ConfigSchema.ConfigOutput> {
      return load(configPath);
    }

    export function parseEnvironment(): Partial<ConfigSchema.ConfigInput> {
      return ConfigSchema.parseEnvironmentVariables();
    }
  }

  // API Key Management Integration
  export namespace ApiKeys {
    const apiKeyManager = ApiKeyManager.getInstance();

    export async function store(
      providerId: string,
      apiKey: string,
      useKeychain = true,
    ): Promise<void> {
      return apiKeyManager.storeKey(providerId, apiKey, useKeychain);
    }

    export async function get(providerId: string): Promise<string | null> {
      return apiKeyManager.getKey(providerId);
    }

    export async function remove(providerId: string): Promise<void> {
      return apiKeyManager.removeKey(providerId);
    }

    export async function list(): Promise<
      Array<{
        providerId: string;
        maskedKey: string;
        source: string;
        createdAt: number;
        lastUsed?: number;
        healthStatus?: "success" | "failed";
        lastHealthCheck?: number;
      }>
    > {
      return apiKeyManager.listKeys();
    }

    export async function validate(
      providerId: string,
      apiKey?: string,
    ): Promise<boolean> {
      return apiKeyManager.validateKey(providerId, apiKey);
    }

    export async function healthCheck(providerId: string): Promise<{
      success: boolean;
      error?: string;
      responseTime?: number;
    }> {
      return apiKeyManager.healthCheck(providerId);
    }

    export async function healthCheckAll(): Promise<
      Record<
        string,
        {
          success: boolean;
          error?: string;
          responseTime?: number;
        }
      >
    > {
      return apiKeyManager.healthCheckAll();
    }

    export function hasKey(providerId: string): boolean {
      return apiKeyManager.hasKey(providerId);
    }

    export function getAvailableProviders(): string[] {
      return apiKeyManager.getAvailableProviders();
    }

    export async function detectAndStore(
      apiKey: string,
      useKeychain = true,
    ): Promise<string | null> {
      return apiKeyManager.detectAndStoreKey(apiKey, useKeychain);
    }
  }
}
