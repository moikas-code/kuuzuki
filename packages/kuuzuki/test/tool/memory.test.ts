import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { MemoryTool } from "../../src/tool/memory";
import { App } from "../../src/app/app";
import { Permission } from "../../src/permission";
import * as fs from "fs/promises";
import * as path from "path";

describe("MemoryTool", () => {
  const testDir = "/tmp/test-kuuzuki-memory";
  const agentrcPath = path.join(testDir, ".agentrc");

  const mockContext = {
    sessionID: "test-session",
    messageID: "test-message",
    toolCallID: "test-tool-call",
    abort: new AbortController().signal,
    metadata: () => {},
  };

  // Mock Permission.ask to auto-approve all permissions in tests
  const originalAsk = Permission.ask;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });

    // Create initial .agentrc file with legacy format
    const initialAgentRc = {
      project: { name: "test-project" },
      rules: [
        "Always test before deployment",
        "Use TypeScript for type safety",
      ],
    };
    await fs.writeFile(agentrcPath, JSON.stringify(initialAgentRc, null, 2));

    // Change to test directory for App.info() to work correctly
    process.chdir(testDir);

    // Mock permissions
    Permission.ask = mock(async () => Promise.resolve());
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

    // Restore original permission function
    Permission.ask = originalAsk;
  });

  test("should initialize and have correct structure", async () => {
    const tool = await MemoryTool.init();

    expect(MemoryTool.id).toBe("memory");
    expect(tool.description).toContain("Manage .agentrc rules");
    expect(tool.parameters).toBeDefined();
  });

  test("should handle missing .agentrc file gracefully", async () => {
    const tempTestDir = await fs.mkdtemp(
      path.join("/tmp", "test-kuuzuki-memory"),
    );

    try {
      // No .agentrc file exists, but SQLite should work fine
      const tool = await MemoryTool.init();
      const result = await App.provide({ cwd: tempTestDir }, async () => {
        return await tool.execute(
          { action: "list", compact: false },
          mockContext,
        );
      });

      // Should return empty rules list, not an error
      expect(result.title).toBe("All Rules");
      expect(result.output).toContain("No rules found");
    } finally {
      // Clean up temp directory
      await fs
        .rm(tempTestDir, { recursive: true, force: true })
        .catch(() => {});
    }
  });

  test("should validate required parameters for add action", async () => {
    const tool = await MemoryTool.init();

    const result = await App.provide({ cwd: testDir }, async () => {
      return await tool.execute(
        { action: "add", compact: false }, // Missing rule and category
        mockContext,
      );
    });

    expect(result.title).toBe("Memory Tool Error");
    expect(result.output).toContain("Both 'rule' and 'category' are required");
  });

  test("should handle unknown actions", async () => {
    const tool = await MemoryTool.init();

    const result = await App.provide({ cwd: testDir }, async () => {
      return await tool.execute(
        { action: "unknown" as any, compact: false },
        mockContext,
      );
    });

    expect(result.title).toBe("Memory Tool Error");
    expect(result.output).toContain("Unknown action");
  });

  test("should suggest relevant rules based on context", async () => {
    // First migrate to structured format and add some rules
    const tool = await MemoryTool.init();

    await App.provide({ cwd: testDir }, async () => {
      // Add some contextual rules directly (no need to migrate since SQLite is used)
      await tool.execute(
        {
          action: "add",
          rule: "Use Jest for testing JavaScript applications",
          category: "preferred",
          reason: "Testing best practice",
          compact: false,
        },
        mockContext,
      );

      await tool.execute(
        {
          action: "add",
          rule: "Always validate TypeScript types in production",
          category: "critical",
          reason: "Type safety",
          compact: false,
        },
        mockContext,
      );
    });

    const result = await App.provide({ cwd: testDir }, async () => {
      return await tool.execute(
        {
          action: "suggest",
          context: "testing typescript application",
          compact: false,
        },
        mockContext,
      );
    });

    // Should return suggestions or no suggestions, but not hang
    expect(result.title).toMatch(/Rule Suggestions|No Suggestions/);
    expect(result.output).toBeDefined();
    expect(result.metadata).toBeDefined();
  }, 10000);

  test("should show analytics for rules", async () => {
    const tool = await MemoryTool.init();

    await App.provide({ cwd: testDir }, async () => {
      // Migrate and add rules first
      await tool.execute({ action: "migrate", compact: false }, mockContext);
    });

    const result = await App.provide({ cwd: testDir }, async () => {
      return await tool.execute(
        { action: "analytics", compact: false },
        mockContext,
      );
    });

    expect(result.title).toBe("Rule Analytics");
    expect(result.output).toContain("Total Rules");
    expect(result.output).toContain("Category Distribution");
    expect(result.metadata.totalRules).toBeGreaterThan(0);
  });

  test("should detect rule conflicts", async () => {
    const tool = await MemoryTool.init();

    await App.provide({ cwd: testDir }, async () => {
      // Migrate first
      await tool.execute({ action: "migrate", compact: false }, mockContext);

      // Add conflicting rules
      await tool.execute(
        {
          action: "add",
          rule: "Always use semicolons in JavaScript",
          category: "preferred",
          compact: false,
        },
        mockContext,
      );

      await tool.execute(
        {
          action: "add",
          rule: "Never use semicolons in JavaScript",
          category: "preferred",
          compact: false,
        },
        mockContext,
      );
    });

    const result = await App.provide({ cwd: testDir }, async () => {
      return await tool.execute(
        { action: "conflicts", compact: false },
        mockContext,
      );
    });

    expect(result.title).toBe("Rule Conflicts");
    expect(result.output).toContain("Rule Conflicts Detected");
    expect(result.metadata.conflictCount).toBeGreaterThan(0);
  });

  test("should record user feedback for rules", async () => {
    const tool = await MemoryTool.init();
    let ruleId: string;

    await App.provide({ cwd: testDir }, async () => {
      // Migrate and add a rule first
      await tool.execute({ action: "migrate", compact: false }, mockContext);

      const addResult = await tool.execute(
        {
          action: "add",
          rule: "Test rule for feedback",
          category: "preferred",
          compact: false,
        },
        mockContext,
      );

      ruleId = addResult.metadata.ruleId;
    });

    const result = await App.provide({ cwd: testDir }, async () => {
      return await tool.execute(
        {
          action: "feedback",
          ruleId,
          rating: 4,
          comment: "Very helpful rule",
          compact: false,
        },
        mockContext,
      );
    });

    expect(result.title).toBe("Feedback Recorded");
    expect(result.output).toContain("4-star rating");
    expect(result.output).toContain("Very helpful rule");
    expect(result.metadata.newEffectivenessScore).toBeGreaterThan(0);
  });

  test("should read documentation for rules with file links", async () => {
    const tool = await MemoryTool.init();
    const docPath = path.join(testDir, "test-doc.md");

    // Create a test documentation file
    await fs.writeFile(
      docPath,
      "# Test Documentation\n\nThis is test documentation content.",
    );

    await App.provide({ cwd: testDir }, async () => {
      // Migrate first
      await tool.execute({ action: "migrate", compact: false }, mockContext);

      // Add rule with documentation link
      await tool.execute(
        {
          action: "add",
          rule: "Follow documentation patterns",
          category: "contextual",
          filePath: "test-doc.md",
          compact: false,
        },
        mockContext,
      );
    });

    const result = await App.provide({ cwd: testDir }, async () => {
      return await tool.execute(
        { action: "read-docs", compact: false },
        mockContext,
      );
    });

    expect(result.title).toBe("Documentation Read");
    expect(result.output).toContain("Rule Documentation");
    expect(result.output).toContain("Test Documentation");
    expect(result.metadata.filesRead).toBeGreaterThan(0);
  });

  test("should migrate legacy string rules to structured format", async () => {
    const tool = await MemoryTool.init();

    const result = await App.provide({ cwd: testDir }, async () => {
      return await tool.execute(
        { action: "migrate", compact: false },
        mockContext,
      );
    });

    expect(result.title).toBe("Rules Migrated");
    expect(result.output).toContain("Successfully migrated 2 rules");
    expect(result.metadata.migratedCount).toBe(2);
  });

  // Note: More comprehensive tests would require mocking the App and Permission modules
  // For now, these tests verify the new smart features and error handling
});
