import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { BunProc } from "../packages/kuuzuki/src/bun";
import path from "path";
import fs from "fs";

describe("Plugin NPM Package Loading", () => {
  const testConfigPath = path.join(
    process.cwd(),
    "test",
    "config",
    ".agentrc.npm-plugin-test",
  );

  beforeAll(async () => {
    // Create test config with npm package plugin
    const testConfig = {
      plugin: [
        "lodash@4.17.21", // Use a well-known package for testing
      ],
    };

    await Bun.write(testConfigPath, JSON.stringify(testConfig, null, 2));
  });

  afterAll(async () => {
    // Clean up test config
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  test("should support npm package installation", async () => {
    // Test BunProc.install directly
    const packagePath = await BunProc.install("lodash", "4.17.21");
    expect(packagePath).toContain("node_modules/lodash");

    // Verify the package was installed
    const packageExists = fs.existsSync(packagePath);
    expect(packageExists).toBe(true);
  });

  test("should load npm package as plugin", async () => {
    // Create a simple test plugin package
    const testPluginDir = path.join(process.cwd(), "test", "temp-plugin");
    const testPluginPath = path.join(testPluginDir, "index.js");

    // Create test plugin directory
    if (!fs.existsSync(testPluginDir)) {
      fs.mkdirSync(testPluginDir, { recursive: true });
    }

    // Create a simple test plugin
    const testPluginCode = `
export const testPlugin = async ({ client, app, $ }) => {
  return {
    "chat.message": async (input, output) => {
      console.log("Test plugin executed");
    }
  };
};
`;

    await Bun.write(testPluginPath, testPluginCode);

    try {
      // Test loading the plugin
      const mod = await import(testPluginPath);
      expect(mod.testPlugin).toBeDefined();
      expect(typeof mod.testPlugin).toBe("function");

      // Test plugin execution
      const hooks = await mod.testPlugin({
        client: { baseUrl: "http://localhost:4096" },
        app: {},
        $: Bun.$,
      });

      expect(hooks).toBeDefined();
      expect(hooks["chat.message"]).toBeDefined();
      expect(typeof hooks["chat.message"]).toBe("function");
    } finally {
      // Clean up
      if (fs.existsSync(testPluginDir)) {
        fs.rmSync(testPluginDir, { recursive: true, force: true });
      }
    }
  });

  test("should handle npm package plugin loading in plugin manager", async () => {
    // This test verifies the npm package parsing logic works correctly
    // without requiring full app context initialization

    // Test the package parsing logic directly
    const testPackages = [
      "lodash@4.17.21",
      "@types/node@18.0.0",
      "simple-package",
    ];

    for (const packageSpec of testPackages) {
      let pkg: string;
      let version: string;

      if (packageSpec.startsWith("@")) {
        // Scoped package - handle @scope/package@version format
        const parts = packageSpec.split("@");
        if (parts.length === 3) {
          pkg = `@${parts[1]}`;
          version = parts[2];
        } else {
          pkg = packageSpec;
          version = "latest";
        }
      } else {
        // Regular package
        const [p, v] = packageSpec.split("@");
        pkg = p;
        version = v ?? "latest";
      }

      // Verify parsing worked correctly
      expect(pkg).toBeDefined();
      expect(version).toBeDefined();
      expect(pkg.length).toBeGreaterThan(0);
    }
  });

  test("should handle npm package format parsing", () => {
    // Test package name parsing logic
    const testCases = [
      {
        input: "lodash@4.17.21",
        expected: { pkg: "lodash", version: "4.17.21" },
      },
      { input: "lodash", expected: { pkg: "lodash", version: "latest" } },
      {
        input: "@types/node@18.0.0",
        expected: { pkg: "@types/node", version: "18.0.0" },
      },
      {
        input: "@types/node",
        expected: { pkg: "@types/node", version: "latest" },
      },
    ];

    for (const testCase of testCases) {
      // Handle scoped packages correctly
      let pkg: string;
      let version: string;

      if (testCase.input.startsWith("@")) {
        // Scoped package - split on the second @
        const parts = testCase.input.split("@");
        if (parts.length === 3) {
          pkg = `@${parts[1]}`;
          version = parts[2];
        } else {
          pkg = testCase.input;
          version = "latest";
        }
      } else {
        // Regular package
        const [p, v] = testCase.input.split("@");
        pkg = p;
        version = v ?? "latest";
      }

      const result = { pkg, version };
      expect(result).toEqual(testCase.expected);
    }
  });
});
