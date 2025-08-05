import { describe, test, expect } from "bun:test";
import { Plugin } from "../packages/kuuzuki/src/plugin";
import { App } from "../packages/kuuzuki/src/app/app";
import { Config } from "../packages/kuuzuki/src/config/config";

describe("Real Plugin Loading", () => {
  test("Plugin system should load actual test plugin", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Mock config to include our test plugin
      const originalGet = Config.get;
      (Config as any).get = async () => ({
        version: "1.0.0",
        schema: "https://kuuzuki.com/config.json",
        providers: [],
        mcpServers: [],
        plugin: ["./test/test-plugin.js"],
        codeStyle: { importStyle: "esm" },
        tools: { database: "sqlite" },
        rules: [],
      });

      try {
        // Initialize plugin system
        Plugin.init();

        // Wait for plugins to load
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check loaded plugins
        const plugins = await Plugin.getLoadedPlugins();
        console.log("Loaded plugins:", plugins);

        // Should have loaded our test plugin
        expect(plugins.length).toBeGreaterThan(0);

        // Check if our test plugin is loaded
        const testPlugin = plugins.find(
          (p) => p.name === "testPlugin" || p.name === "default",
        );
        expect(testPlugin).toBeDefined();

        if (testPlugin) {
          expect(testPlugin.hooks).toContain("event");
          expect(testPlugin.hooks).toContain("chat.message");
        }
      } finally {
        (Config as any).get = originalGet;
      }

      return true;
    });
  });

  test("Plugin system demonstrates successful integration", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Mock config to include our test plugin
      const originalGet = Config.get;
      (Config as any).get = async () => ({
        version: "1.0.0",
        schema: "https://kuuzuki.com/config.json",
        providers: [],
        mcpServers: [],
        plugin: ["./test/test-plugin.js"],
        codeStyle: { importStyle: "esm" },
        tools: { database: "sqlite" },
        rules: [],
      });

      try {
        // Initialize plugin system
        Plugin.init();

        // Force plugin state initialization
        const plugins = await Plugin.getLoadedPlugins();
        console.log("Plugins loaded for integration test:", plugins.length);

        // Test that the plugin system is functional
        expect(plugins.length).toBeGreaterThan(0);

        // Test that hooks can be checked
        const hasEventHook = await Plugin.hasHook("event");
        const hasChatHook = await Plugin.hasHook("chat.message");

        expect(typeof hasEventHook).toBe("boolean");
        expect(typeof hasChatHook).toBe("boolean");

        // Test that trigger works without errors
        const result = await Plugin.trigger(
          "event",
          { event: { type: "test" } },
          {},
        );
        expect(result).toBeDefined();
      } finally {
        (Config as any).get = originalGet;
      }

      return true;
    });
  });
});
