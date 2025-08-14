import { App } from "../app/app";
import { Config } from "../config/config";
import { Bus } from "../bus";
import { Log } from "../util/log";
import { BunProc } from "../bun";
import { pathOr } from "remeda";
import path from "path";

// Local plugin types (will be synced with @kuuzuki/plugin package)
interface KuuzukiClient {
  baseUrl: string;
}

interface PluginInput {
  client: KuuzukiClient;
  app: any;
  $: typeof Bun.$;
}

interface Hooks {
  event?: (input: { event: any }) => Promise<void>;
  "chat.message"?: (
    input: {},
    output: { message: any; parts: any[] },
  ) => Promise<void>;
  "chat.params"?: (
    input: { model: any; provider: any; message: any },
    output: { temperature?: number; topP?: number },
  ) => Promise<void>;
  "permission.ask"?: (
    input: any,
    output: { status: "ask" | "deny" | "allow" },
  ) => Promise<void>;
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any },
  ) => Promise<void>;
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { title: string; output: string; metadata: any },
  ) => Promise<void>;
}

type PluginInstance = (input: PluginInput) => Promise<Hooks>;

interface PluginWithMetadata {
  metadata: any;
  plugin: PluginInstance;
}

/**
 * Plugin Manager for kuuzuki
 *
 * Handles loading, initialization, and execution of plugins.
 * Provides a hook system for plugins to extend kuuzuki functionality.
 */
export namespace Plugin {
  const log = Log.create({ service: "plugin" });

  interface LoadedPlugin {
    name: string;
    metadata?: any;
    hooks: Hooks;
    path: string;
  }

  /**
   * Plugin state management
   */
  const state = App.state("plugin", async (app) => {
    const config = await Config.get();
    const loadedPlugins: LoadedPlugin[] = [];

    // Create a simple client for plugins (will be enhanced later)
    const client: KuuzukiClient = {
      baseUrl: "http://localhost:4096", // Default server URL
    };

    // Load plugins from configuration
    for (let pluginPath of config.plugin ?? []) {
      try {
        log.info("Loading plugin", { path: pluginPath });

        // Resolve plugin path - support npm packages like OpenCode
        let resolvedPath: string;

        if (
          !pluginPath.startsWith("file://") &&
          !pluginPath.startsWith(".") &&
          !path.isAbsolute(pluginPath)
        ) {
          // NPM package - install and get path
          let pkg: string;
          let version: string;

          if (pluginPath.startsWith("@")) {
            // Scoped package - handle @scope/package@version format
            const parts = pluginPath.split("@");
            if (parts.length === 3) {
              pkg = `@${parts[1]}`;
              version = parts[2];
            } else {
              pkg = pluginPath;
              version = "latest";
            }
          } else {
            // Regular package
            const [p, v] = pluginPath.split("@");
            pkg = p;
            version = v ?? "latest";
          }

          log.info("Installing plugin package", { pkg, version });
          resolvedPath = await BunProc.install(pkg, version);
        } else if (pluginPath.startsWith("file://")) {
          // File URL - remove protocol
          resolvedPath = pluginPath.slice(7);
        } else {
          // File path - resolve relative to app root
          resolvedPath = pluginPath.startsWith(".")
            ? path.resolve(app.path.root, pluginPath)
            : pluginPath;
        }

        // Dynamic import of the plugin module
        const mod = await import(resolvedPath);

        // Handle different plugin export patterns
        for (const [exportName, exportValue] of Object.entries(mod)) {
          if (typeof exportValue === "function") {
            // Direct plugin function
            try {
              const hooks = await (exportValue as PluginInstance)({
                client,
                app,
                $: Bun.$,
              });

              loadedPlugins.push({
                name: exportName,
                hooks,
                path: pluginPath, // Keep original path for metadata
              });

              log.info("Plugin loaded successfully", {
                name: exportName,
                path: pluginPath,
                hooks: Object.keys(hooks),
              });
            } catch (error) {
              log.error("Failed to initialize plugin", {
                name: exportName,
                path: pluginPath,
                error,
              });
            }
          } else if (
            exportValue &&
            typeof exportValue === "object" &&
            "plugin" in exportValue
          ) {
            // Plugin with metadata
            const pluginWithMeta = exportValue as PluginWithMetadata;
            try {
              const hooks = await pluginWithMeta.plugin({
                client,
                app,
                $: Bun.$,
              });

              loadedPlugins.push({
                name: pluginWithMeta.metadata.name,
                metadata: pluginWithMeta.metadata,
                hooks,
                path: pluginPath, // Keep original path for metadata
              });

              log.info("Plugin with metadata loaded successfully", {
                name: pluginWithMeta.metadata.name,
                version: pluginWithMeta.metadata.version,
                path: pluginPath,
                hooks: Object.keys(hooks),
              });
            } catch (error) {
              log.error("Failed to initialize plugin with metadata", {
                name: pluginWithMeta.metadata.name,
                path: pluginPath,
                error,
              });
            }
          }
        }
      } catch (error) {
        log.error("Failed to load plugin module", { path: pluginPath, error });
      }
    }

    log.info("Plugin system initialized", {
      totalPlugins: loadedPlugins.length,
      plugins: loadedPlugins.map((p) => ({
        name: p.name,
        hooks: Object.keys(p.hooks),
      })),
    });

    return {
      plugins: loadedPlugins,
    };
  });

  /**
   * Type-safe path extraction for nested hook names
   */
  type Path<T, Prefix extends string = ""> = T extends object
    ? {
        [K in keyof T]: K extends string
          ? T[K] extends Function | undefined
            ? `${Prefix}${K}`
            : Path<T[K], `${Prefix}${K}.`>
          : never;
      }[keyof T]
    : never;

  /**
   * Extract function type from hook path
   */
  export type FunctionFromKey<
    T,
    P extends Path<T>,
  > = P extends `${infer K}.${infer R}`
    ? K extends keyof T
      ? R extends Path<T[K]>
        ? FunctionFromKey<T[K], R>
        : never
      : never
    : P extends keyof T
      ? T[P]
      : never;

  /**
   * Trigger a plugin hook across all loaded plugins
   */
  export async function trigger<
    Name extends Path<Required<Hooks>>,
    Input = Parameters<FunctionFromKey<Required<Hooks>, Name>>[0],
    Output = Parameters<FunctionFromKey<Required<Hooks>, Name>>[1],
  >(hookName: Name, input: Input, output: Output): Promise<Output> {
    if (!hookName) return output;

    try {
      const { plugins } = await state();
      const path = hookName.split(".");

      for (const plugin of plugins) {
        try {
          // Extract the hook function using the full hook name first
          let hookFn: Function | undefined = (plugin.hooks as any)[hookName];

          // If not found, try nested path approach for backward compatibility
          if (!hookFn && path.length > 1) {
            hookFn = pathOr(plugin.hooks as any, path as any, undefined) as
              | Function
              | undefined;
          }

          if (hookFn && typeof hookFn === "function") {
            await hookFn(input, output);
          }
        } catch (error) {
          log.error("Plugin hook execution error", {
            plugin: plugin.name,
            hook: hookName,
            error: error instanceof Error ? error.message : String(error),
          });

          // Don't let plugin errors break the system
          // Just log and continue with other plugins
        }
      }
    } catch (error) {
      log.error("Plugin trigger system error", {
        hook: hookName,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return output;
  }

  /**
   * Get information about loaded plugins
   */
  export async function getLoadedPlugins(): Promise<
    Array<{
      name: string;
      metadata?: any;
      hooks: string[];
      path: string;
    }>
  > {
    try {
      const { plugins } = await state();
      return plugins.map((plugin) => ({
        name: plugin.name,
        metadata: plugin.metadata,
        hooks: Object.keys(plugin.hooks),
        path: plugin.path,
      }));
    } catch (error) {
      log.error("Failed to get loaded plugins", { error });
      return [];
    }
  }

  /**
   * Check if a specific hook is available
   */
  export async function hasHook(
    hookName: Path<Required<Hooks>>,
  ): Promise<boolean> {
    try {
      const { plugins } = await state();
      const path = hookName.split(".");

      return plugins.some((plugin) => {
        let hookFn: Function | undefined;

        if (path.length === 1) {
          hookFn = (plugin.hooks as any)[path[0]];
        } else {
          hookFn = pathOr(plugin.hooks as any, path as any, undefined) as
            | Function
            | undefined;
        }

        return hookFn && typeof hookFn === "function";
      });
    } catch (error) {
      log.error("Failed to check hook availability", { hook: hookName, error });
      return false;
    }
  }

  /**
   * Initialize the plugin system
   * This should be called during app startup
   */
  export function init() {
    log.info("Initializing plugin system");

    // Subscribe to all bus events and forward to plugins
    Bus.subscribeAll((event) => {
      // Fire and forget - don't block the bus
      trigger("event", { event }, {}).catch((error) => {
        log.error("Plugin event forwarding error", { error });
      });
    });

    log.info("Plugin system event forwarding initialized");
  }

  /**
   * Shutdown the plugin system
   * Clean up resources and notify plugins
   */
  export async function shutdown() {
    try {
      log.info("Shutting down plugin system");

      // Trigger shutdown event for plugins
      await trigger(
        "event",
        {
          event: {
            type: "system.shutdown",
            data: {},
            timestamp: Date.now(),
          },
        },
        {},
      );

      log.info("Plugin system shutdown complete");
    } catch (error) {
      log.error("Error during plugin system shutdown", { error });
    }
  }
}
