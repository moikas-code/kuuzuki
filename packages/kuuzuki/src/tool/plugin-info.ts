import { z } from "zod";
import { Tool } from "./tool";
import { Plugin } from "../plugin";

export const PluginInfoTool = Tool.define("plugin_info", {
  description: "Show information about loaded plugins",
  parameters: z.object({
    format: z
      .enum(["summary", "detailed"])
      .default("summary")
      .describe("Output format"),
  }),
  execute: async ({ format }, { sessionID }) => {
    const plugins = await Plugin.getLoadedPlugins();

    if (plugins.length === 0) {
      return {
        title: "🔌 Plugin System Status",
        output: `**No plugins loaded**

The plugin system is active but no plugins are currently loaded.

To add plugins:
1. Add plugin paths to your \`.agentrc\` file
2. Restart kuuzuki to load the plugins
3. Check console output for plugin loading messages`,
        metadata: {
          pluginCount: 0,
          sessionID,
        },
      };
    }

    if (format === "detailed") {
      const detailed = plugins
        .map((plugin) => {
          const hooks = plugin.hooks.join(", ");
          return `### ${plugin.name}
  **Path**: \`${plugin.path}\`
  **Hooks**: ${hooks}`;
        })
        .join("\n\n");

      return {
        title: `🔌 Plugin System Details (${plugins.length} loaded)`,
        output: detailed,
        metadata: {
          pluginCount: plugins.length,
          sessionID,
        },
      };
    }

    // Summary format
    const summary = plugins
      .map((p) => `• **${p.name}** (${p.hooks.length} hooks)`)
      .join("\n");

    return {
      title: `🔌 Loaded Plugins (${plugins.length})`,
      output: `${summary}

**Total Hooks**: ${plugins.reduce((sum, p) => sum + p.hooks.length, 0)}

Use \`plugin_info --format=detailed\` for more information.`,
      metadata: {
        pluginCount: plugins.length,
        sessionID,
      },
    };
  },
});
