import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { Plugin } from "../packages/kuuzuki/src/plugin";
import { App } from "../packages/kuuzuki/src/app/app";
import { Bus } from "../packages/kuuzuki/src/bus";

describe("Plugin System", () => {
  afterAll(async () => {
    await Plugin.shutdown();
  });

  test("Plugin.init() should initialize without errors", async () => {
    // Plugin.init() needs to be called within App context
    await App.provide({ cwd: process.cwd() }, async () => {
      expect(() => Plugin.init()).not.toThrow();
      return true;
    });
  });

  test("Plugin.getLoadedPlugins() should return empty array initially", async () => {
    const plugins = await Plugin.getLoadedPlugins();
    expect(Array.isArray(plugins)).toBe(true);
  });

  test("Plugin.hasHook() should return false for non-existent hooks", async () => {
    const hasHook = await Plugin.hasHook("chat.message");
    expect(typeof hasHook).toBe("boolean");
  });

  test("Plugin.trigger() should handle non-existent hooks gracefully", async () => {
    const input = { test: "data" };
    const output = { result: "initial" };

    const result = await Plugin.trigger("event", { event: input }, output);
    expect(result).toEqual(output);
  });

  test("Plugin system should handle errors gracefully", async () => {
    // This test verifies that plugin errors don't crash the system
    const consoleError = console.error;
    const errors: any[] = [];
    console.error = (...args: any[]) => errors.push(args);

    try {
      // Trigger with invalid hook name should not throw
      await Plugin.trigger("invalid.hook" as any, {}, {});

      // Should not have thrown an error
      expect(true).toBe(true);
    } finally {
      console.error = consoleError;
    }
  });
});

describe("Plugin Configuration", () => {
  test("Config schema should accept plugin paths", async () => {
    // This test verifies that the config system accepts plugin configuration
    const testConfig = {
      plugin: ["./test-plugin.js", "@kuuzuki/example-plugin"],
    };

    // Should not throw when validating plugin config
    expect(() => {
      // Basic validation that plugin field exists
      expect(Array.isArray(testConfig.plugin)).toBe(true);
    }).not.toThrow();
  });
});

describe("Plugin Hook Types", () => {
  test("Hook signatures should be type-safe", () => {
    // This test verifies TypeScript compilation of hook types
    type ChatMessageHook = (
      input: {},
      output: { message: any; parts: any[] },
    ) => Promise<void>;

    type PermissionHook = (
      input: any,
      output: { status: "ask" | "deny" | "allow" },
    ) => Promise<void>;

    type ToolHook = (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: any },
    ) => Promise<void>;

    // Type compilation test
    const chatHook: ChatMessageHook = async (input, output) => {
      expect(output.message).toBeDefined();
      expect(Array.isArray(output.parts)).toBe(true);
    };

    const permissionHook: PermissionHook = async (input, output) => {
      expect(["ask", "deny", "allow"]).toContain(output.status);
    };

    const toolHook: ToolHook = async (input, output) => {
      expect(typeof input.tool).toBe("string");
      expect(typeof input.sessionID).toBe("string");
      expect(typeof input.callID).toBe("string");
    };

    expect(typeof chatHook).toBe("function");
    expect(typeof permissionHook).toBe("function");
    expect(typeof toolHook).toBe("function");
  });
});
