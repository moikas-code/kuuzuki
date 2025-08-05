import type { $ } from "bun";

/**
 * Kuuzuki Plugin System
 *
 * This package provides the core interfaces and types for developing kuuzuki plugins.
 * Plugins can extend kuuzuki's functionality by hooking into various system events
 * and operations.
 */

// Core types that plugins need to work with
export interface App {
  hostname: string;
  git: boolean;
  path: {
    config: string;
    data: string;
    root: string;
    cwd: string;
    state: string;
  };
  time: {
    initialized?: number;
  };
}

export interface UserMessage {
  id: string;
  role: "user";
  content: string;
  sessionID: string;
  time: {
    created: number;
  };
}

export interface Part {
  id: string;
  type: string;
  content: any;
  metadata?: Record<string, any>;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  temperature?: number;
  limit: {
    context?: number;
    output?: number;
  };
  tool_call?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  type: string;
  config?: Record<string, any>;
}

export interface Permission {
  id: string;
  type: string;
  pattern?: string;
  status: "ask" | "allow" | "deny";
  metadata?: Record<string, any>;
}

export interface Event {
  type: string;
  data: any;
  timestamp: number;
  sessionID?: string;
}

// Plugin client interface (simplified for now)
export interface KuuzukiClient {
  // Will be expanded as we build the SDK
  baseUrl: string;
}

export function createKuuzukiClient(config: {
  baseUrl: string;
}): KuuzukiClient {
  return {
    baseUrl: config.baseUrl,
  };
}

/**
 * Plugin input provided when initializing a plugin
 */
export interface PluginInput {
  /** kuuzuki client for API access */
  client: KuuzukiClient;
  /** App information and context */
  app: App;
  /** Bun shell utility */
  $: typeof $;
}

/**
 * Plugin hooks interface - defines all available hook points
 */
export interface Hooks {
  /** Global event hook - receives all system events */
  event?: (input: { event: Event }) => Promise<void>;

  /** Chat message hook - called when new messages are received */
  "chat.message"?: (
    input: {},
    output: { message: UserMessage; parts: Part[] },
  ) => Promise<void>;

  /** Chat parameters hook - modify LLM parameters before generation */
  "chat.params"?: (
    input: { model: Model; provider: Provider; message: UserMessage },
    output: { temperature?: number; topP?: number },
  ) => Promise<void>;

  /** Permission hook - custom permission logic */
  "permission.ask"?: (
    input: Permission,
    output: { status: "ask" | "deny" | "allow" },
  ) => Promise<void>;

  /** Tool execution before hook - modify tool arguments */
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any },
  ) => Promise<void>;

  /** Tool execution after hook - process tool results */
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { title: string; output: string; metadata: any },
  ) => Promise<void>;
}

/**
 * Plugin function type - the main plugin entry point
 */
export type Plugin = (input: PluginInput) => Promise<Hooks>;

/**
 * Plugin metadata interface
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  keywords?: string[];
}

/**
 * Plugin with metadata
 */
export interface PluginWithMetadata {
  metadata: PluginMetadata;
  plugin: Plugin;
}

/**
 * Helper function to define a plugin with metadata
 */
export function definePlugin(
  metadata: PluginMetadata,
  plugin: Plugin,
): PluginWithMetadata {
  return { metadata, plugin };
}

/**
 * Plugin error types
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginName: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "PluginError";
  }
}

export class PluginLoadError extends PluginError {
  constructor(pluginName: string, cause?: Error) {
    super(`Failed to load plugin: ${pluginName}`, pluginName, cause);
    this.name = "PluginLoadError";
  }
}

export class PluginExecutionError extends PluginError {
  constructor(pluginName: string, hookName: string, cause?: Error) {
    super(
      `Plugin execution error in ${pluginName}.${hookName}`,
      pluginName,
      cause,
    );
    this.name = "PluginExecutionError";
  }
}

// Re-export types for convenience
export type { $ } from "bun";
