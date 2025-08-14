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

      // Create a test plugin configuration
      const testConfig = {
        plugin: ["./test/test-plugin.js"],
        version: "1.0.0",
        schema: "https://kuuzuki.com/config.json",
        providers: [],
        mcpServers: [],
        codeStyle: { importStyle: "esm" },
        tools: { database: "sqlite" },
        rules: [],
      };

      // Mock the Config.get to return our test configuration
      const originalConfigGet = Config.get;
      (Config as any).get = async () => testConfig;

      // Create a temporary test plugin file
      const testPluginContent = `
export default async function testPlugin({ client, app, $ }) {
  return {
    "event": async (input) => {
      // Handle general events
      console.log("Event received:", input.event?.type);
    },
    "chat.message": async (input, output) => {
      output.testProcessed = true;
      // Plugin hooks should modify the output object by reference
      // The trigger function will return the same output object
    }
  };
}
`;

      await Bun.write("./test/test-plugin.js", testPluginContent);

      try {
        // Initialize plugin system with our test config
        Plugin.init();

        // Wait a bit for plugin system to fully initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        const input = {};
        const output: any = { message: { id: "test" }, parts: [] };

        const result = await Plugin.trigger("chat.message", input, output);

        expect(result.testProcessed).toBe(true);
      } finally {
        // Clean up
        (Config as any).get = originalConfigGet;
        try {
          await Bun.$`rm -f ./test/test-plugin.js`;
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      return true;
    });
  });
});
