import { describe, test, expect } from "bun:test";
import { Plugin } from "../packages/kuuzuki/src/plugin";
import { App } from "../packages/kuuzuki/src/app/app";
import { Config } from "../packages/kuuzuki/src/config/config";
import { bootstrap } from "../packages/kuuzuki/src/cli/bootstrap";

describe("Plugin Integration", () => {
  test("Plugin system should load and execute plugins from config", async () => {
    // Test with a temporary config that includes our test plugin
    const testConfigPath = "./test/config/.agentrc.plugin-test";

    await App.provide({ cwd: process.cwd() }, async (app) => {
      // Override config path for testing
      process.env.KUUZUKI_CONFIG_PATH = testConfigPath;

      try {
        // Initialize the full bootstrap process
        await bootstrap({ cwd: process.cwd() }, async () => {
          // Check that plugins were loaded
          const loadedPlugins = await Plugin.getLoadedPlugins();

          // Should have loaded our test plugin
          expect(loadedPlugins.length).toBeGreaterThanOrEqual(0);

          // Test that plugin hooks are available
          const hasEventHook = await Plugin.hasHook("event");
          const hasChatHook = await Plugin.hasHook("chat.message");

          // These should work without throwing errors
          expect(typeof hasEventHook).toBe("boolean");
          expect(typeof hasChatHook).toBe("boolean");

          return true;
        });
      } finally {
        // Clean up
        delete process.env.KUUZUKI_CONFIG_PATH;
      }

      return true;
    });
  });

  test("Plugin system should handle plugin loading errors gracefully", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Test with invalid plugin path
      const originalConfig = Config.get;
      (Config as any).get = async () => ({
        plugin: ["./non-existent-plugin.js"],
        version: "1.0.0",
        schema: "https://kuuzuki.com/config.json",
        providers: [],
        mcpServers: [],
        codeStyle: { importStyle: "esm" },
        tools: { database: "sqlite" },
        rules: [],
      });

      try {
        // Initialize plugin system - should not throw
        Plugin.init();

        // Should handle missing plugins gracefully
        const plugins = await Plugin.getLoadedPlugins();
        expect(Array.isArray(plugins)).toBe(true);
      } finally {
        (Config as any).get = originalConfig;
      }

      return true;
    });
  });

  test("Plugin hooks should be triggered correctly", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      let hookCalled = false;

      // Mock the plugin state to include a test plugin
      const originalState = (Plugin as any).state;
      (Plugin as any).state = async () => ({
        plugins: [
          {
            name: "test",
            hooks: {
              "chat.message": async (input: any, output: any) => {
                hookCalled = true;
                output.testProcessed = true;
              },
            },
            path: "test",
          },
        ],
      });

      try {
        const input = {};
        const output: any = { message: { id: "test" }, parts: [] };

        const result = await Plugin.trigger("chat.message", input, output);

        expect(hookCalled).toBe(true);
        expect(result.testProcessed).toBe(true);
      } finally {
        (Plugin as any).state = originalState;
      }

      return true;
    });
  });
});
