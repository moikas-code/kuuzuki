import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { MemoryStorage, RuleRecord, SessionContext } from "./memory-storage";
import * as fs from "fs";
import * as path from "path";

describe("MemoryStorage", () => {
  let storage: MemoryStorage;
  let testDbPath: string;

  beforeEach(() => {
    // Create isolated test database with unique name including random component
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    testDbPath = path.join(
      process.cwd(),
      ".kuuzuki-test",
      `memory-test-${timestamp}-${random}.db`,
    );
    const testDir = path.dirname(testDbPath);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Ensure any existing database is removed
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create test instance (bypasses singleton)
    storage = MemoryStorage.createTestInstance(testDbPath);
  });

  afterEach(() => {
    // Cleanup test database
    storage.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    (MemoryStorage as any).instance = null;
  });

  describe("Rule Management", () => {
    test("should add and retrieve rules", () => {
      const rule: Omit<RuleRecord, "createdAt" | "usageCount"> = {
        id: "test-rule-1",
        text: "Always test your code",
        category: "critical",
        reason: "Testing is essential",
        analytics: JSON.stringify({ effectivenessScore: 0.8 }),
        documentationLinks: JSON.stringify([]),
        tags: JSON.stringify(["testing"]),
      };

      storage.addRule(rule);
      const retrieved = storage.getRule("test-rule-1");

      expect(retrieved).toBeTruthy();
      expect(retrieved?.text).toBe("Always test your code");
      expect(retrieved?.category).toBe("critical");
      expect(retrieved?.usageCount).toBe(0);
    });

    test("should update existing rules", () => {
      const rule: Omit<RuleRecord, "createdAt" | "usageCount"> = {
        id: "test-rule-2",
        text: "Original text",
        category: "preferred",
        reason: "Original reason",
        analytics: JSON.stringify({}),
        documentationLinks: JSON.stringify([]),
        tags: JSON.stringify([]),
      };

      // Add the rule first
      storage.addRule(rule);

      // Verify it was added
      const beforeUpdate = storage.getRule("test-rule-2");
      expect(beforeUpdate).toBeTruthy();
      expect(beforeUpdate?.text).toBe("Original text");

      // Now update it
      const updated = storage.updateRule("test-rule-2", {
        text: "Updated text",
        reason: "Updated for testing",
      });

      expect(updated).toBe(true);
      const retrieved = storage.getRule("test-rule-2");
      expect(retrieved?.text).toBe("Updated text");
      expect(retrieved?.reason).toBe("Updated for testing");
    });

    test("should remove rules", () => {
      const rule: Omit<RuleRecord, "createdAt" | "usageCount"> = {
        id: "test-rule-3",
        text: "To be deleted",
        category: "deprecated",
        analytics: JSON.stringify({}),
        documentationLinks: JSON.stringify([]),
        tags: JSON.stringify([]),
      };

      storage.addRule(rule);
      expect(storage.getRule("test-rule-3")).toBeTruthy();

      const removed = storage.removeRule("test-rule-3");
      expect(removed).toBe(true);
      expect(storage.getRule("test-rule-3")).toBeNull();
    });

    test("should search rules by text", () => {
      const rules = [
        {
          id: "search-1",
          text: "Always use TypeScript",
          category: "critical" as const,
          analytics: JSON.stringify({}),
          documentationLinks: JSON.stringify([]),
          tags: JSON.stringify(["typescript"]),
        },
        {
          id: "search-2",
          text: "Prefer functional programming",
          category: "preferred" as const,
          analytics: JSON.stringify({}),
          documentationLinks: JSON.stringify([]),
          tags: JSON.stringify(["functional"]),
        },
      ];

      rules.forEach((rule) => storage.addRule(rule));

      const results = storage.searchRules("TypeScript");
      expect(results).toHaveLength(1);
      expect(results[0].text).toBe("Always use TypeScript");

      const noResults = storage.searchRules("nonexistent");
      expect(noResults).toHaveLength(0);
    });

    test("should get rules by category", () => {
      const rules = [
        {
          id: "cat-1",
          text: "Critical rule",
          category: "critical" as const,
          analytics: JSON.stringify({}),
          documentationLinks: JSON.stringify([]),
          tags: JSON.stringify([]),
        },
        {
          id: "cat-2",
          text: "Preferred rule",
          category: "preferred" as const,
          analytics: JSON.stringify({}),
          documentationLinks: JSON.stringify([]),
          tags: JSON.stringify([]),
        },
      ];

      rules.forEach((rule) => storage.addRule(rule));

      const criticalRules = storage.getRulesByCategory("critical");
      expect(criticalRules).toHaveLength(1);
      expect(criticalRules[0].category).toBe("critical");

      const allRules = storage.getRulesByCategory();
      expect(allRules).toHaveLength(2);
    });
  });

  describe("Session Context", () => {
    test("should store and retrieve session context", () => {
      const context: SessionContext = {
        sessionId: "test-session-1",
        workingDirectory: "/test/dir",
        fileTypes: JSON.stringify(["ts", "js"]),
        recentFiles: JSON.stringify(["test.ts"]),
        lastActivity: new Date().toISOString(),
        contextData: JSON.stringify({ test: true }),
      };

      storage.updateSessionContext(context);
      const retrieved = storage.getSessionContext("test-session-1");

      expect(retrieved).toBeTruthy();
      expect(retrieved?.workingDirectory).toBe("/test/dir");
      expect(JSON.parse(retrieved?.fileTypes || "[]")).toEqual(["ts", "js"]);
    });

    test("should get recent sessions", () => {
      const contexts = [
        {
          sessionId: "session-1",
          workingDirectory: "/dir1",
          fileTypes: JSON.stringify([]),
          recentFiles: JSON.stringify([]),
          lastActivity: new Date(Date.now() - 1000).toISOString(),
          contextData: JSON.stringify({}),
        },
        {
          sessionId: "session-2",
          workingDirectory: "/dir2",
          fileTypes: JSON.stringify([]),
          recentFiles: JSON.stringify([]),
          lastActivity: new Date().toISOString(),
          contextData: JSON.stringify({}),
        },
      ];

      contexts.forEach((ctx) => storage.updateSessionContext(ctx));
      const recent = storage.getRecentSessions(5);

      expect(recent).toHaveLength(2);
      expect(recent[0].sessionId).toBe("session-2"); // Most recent first
    });
  });

  describe("Usage Tracking", () => {
    test("should record and retrieve rule usage", () => {
      const rule: Omit<RuleRecord, "createdAt" | "usageCount"> = {
        id: "usage-rule-1",
        text: "Usage test rule",
        category: "critical",
        analytics: JSON.stringify({}),
        documentationLinks: JSON.stringify([]),
        tags: JSON.stringify([]),
      };

      storage.addRule(rule);
      storage.recordRuleUsage(
        "usage-rule-1",
        "test-session",
        "test context",
        0.9,
      );

      const history = storage.getRuleUsageHistory("usage-rule-1");
      expect(history).toHaveLength(1);
      expect(history[0].ruleId).toBe("usage-rule-1");
      expect(history[0].effectiveness).toBe(0.9);

      // Check that usage count was updated
      const updatedRule = storage.getRule("usage-rule-1");
      expect(updatedRule?.usageCount).toBe(1);
    });

    test("should get session usage history", () => {
      const rule: Omit<RuleRecord, "createdAt" | "usageCount"> = {
        id: "session-rule-1",
        text: "Session test rule",
        category: "preferred",
        analytics: JSON.stringify({}),
        documentationLinks: JSON.stringify([]),
        tags: JSON.stringify([]),
      };

      storage.addRule(rule);
      storage.recordRuleUsage("session-rule-1", "session-123", "context");

      const sessionHistory = storage.getSessionUsageHistory("session-123");
      expect(sessionHistory).toHaveLength(1);
      expect(sessionHistory[0].sessionId).toBe("session-123");
    });
  });

  describe("Analytics", () => {
    test("should generate rule analytics", () => {
      const rules = [
        {
          id: "analytics-1",
          text: "Used rule",
          category: "critical" as const,
          analytics: JSON.stringify({}),
          documentationLinks: JSON.stringify([]),
          tags: JSON.stringify([]),
        },
        {
          id: "analytics-2",
          text: "Unused rule",
          category: "preferred" as const,
          analytics: JSON.stringify({}),
          documentationLinks: JSON.stringify([]),
          tags: JSON.stringify([]),
        },
      ];

      rules.forEach((rule) => storage.addRule(rule));
      storage.recordRuleUsage("analytics-1", "test-session");

      const analytics = storage.getRuleAnalytics(30);
      expect(analytics.totalRules).toBe(2);
      expect(analytics.usedRules).toBe(1);
      expect(analytics.categoryStats.critical).toBe(1);
      expect(analytics.categoryStats.preferred).toBe(1);
    });

    test("should get most used rules", () => {
      const rule: Omit<RuleRecord, "createdAt" | "usageCount"> = {
        id: "popular-rule",
        text: "Popular rule",
        category: "critical",
        analytics: JSON.stringify({}),
        documentationLinks: JSON.stringify([]),
        tags: JSON.stringify([]),
      };

      storage.addRule(rule);
      // Record multiple usages
      for (let i = 0; i < 5; i++) {
        storage.recordRuleUsage("popular-rule", `session-${i}`);
      }

      const mostUsed = storage.getMostUsedRules(5);
      expect(mostUsed).toHaveLength(1);
      expect(mostUsed[0].usageCount).toBe(5);
    });

    test("should get unused rules", () => {
      const oldRule: Omit<RuleRecord, "createdAt" | "usageCount"> = {
        id: "old-unused",
        text: "Old unused rule",
        category: "deprecated",
        analytics: JSON.stringify({}),
        documentationLinks: JSON.stringify([]),
        tags: JSON.stringify([]),
      };

      storage.addRule(oldRule);
      const unused = storage.getUnusedRules(0); // All unused rules
      expect(unused).toHaveLength(1);
      expect(unused[0].id).toBe("old-unused");
    });
  });

  describe("Cleanup Operations", () => {
    test("should cleanup old usage data", () => {
      const rule: Omit<RuleRecord, "createdAt" | "usageCount"> = {
        id: "cleanup-rule",
        text: "Cleanup test rule",
        category: "critical",
        analytics: JSON.stringify({}),
        documentationLinks: JSON.stringify([]),
        tags: JSON.stringify([]),
      };

      storage.addRule(rule);
      storage.recordRuleUsage("cleanup-rule", "test-session");

      const cleaned = storage.cleanupOldUsageData(0); // Clean all
      expect(cleaned).toBe(1);

      const history = storage.getRuleUsageHistory("cleanup-rule");
      expect(history).toHaveLength(0);
    });

    test("should cleanup old sessions", () => {
      const context: SessionContext = {
        sessionId: "old-session",
        workingDirectory: "/test",
        fileTypes: JSON.stringify([]),
        recentFiles: JSON.stringify([]),
        lastActivity: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        contextData: JSON.stringify({}),
      };

      storage.updateSessionContext(context);
      const cleaned = storage.cleanupOldSessions(0); // Clean all
      expect(cleaned).toBe(1);

      const retrieved = storage.getSessionContext("old-session");
      expect(retrieved).toBeNull();
    });

    test("should vacuum database", () => {
      // This test just ensures vacuum doesn't throw
      expect(() => storage.vacuum()).not.toThrow();
    });
  });

  describe("Migration", () => {
    test("should migrate from agentrc format", () => {
      const agentrcRules = {
        critical: [
          {
            id: "migrate-1",
            text: "Migrated critical rule",
            category: "critical",
            analytics: { effectivenessScore: 0.8 },
            documentationLinks: [],
            tags: ["migration"],
          },
        ],
        preferred: [
          {
            id: "migrate-2",
            text: "Migrated preferred rule",
            category: "preferred",
            analytics: {},
            documentationLinks: [],
            tags: [],
          },
        ],
      };

      const migrated = storage.migrateFromAgentRc(agentrcRules);
      expect(migrated).toBe(2);

      const rule1 = storage.getRule("migrate-1");
      const rule2 = storage.getRule("migrate-2");

      expect(rule1?.text).toBe("Migrated critical rule");
      expect(rule2?.text).toBe("Migrated preferred rule");
    });
  });

  describe("Error Handling", () => {
    test("should handle duplicate rule additions", () => {
      const rule: Omit<RuleRecord, "createdAt" | "usageCount"> = {
        id: "duplicate-test",
        text: "Duplicate rule",
        category: "critical",
        analytics: JSON.stringify({}),
        documentationLinks: JSON.stringify([]),
        tags: JSON.stringify([]),
      };

      storage.addRule(rule);

      // Adding duplicate should throw
      expect(() => storage.addRule(rule)).toThrow();
    });

    test("should handle non-existent rule operations", () => {
      expect(storage.getRule("non-existent")).toBeNull();
      expect(storage.updateRule("non-existent", { text: "new" })).toBe(false);
      expect(storage.removeRule("non-existent")).toBe(false);
    });
  });

  describe("Concurrent Access", () => {
    test("should handle concurrent rule additions", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() => {
          const rule: Omit<RuleRecord, "createdAt" | "usageCount"> = {
            id: `concurrent-${i}`,
            text: `Concurrent rule ${i}`,
            category: "preferred",
            analytics: JSON.stringify({}),
            documentationLinks: JSON.stringify([]),
            tags: JSON.stringify([]),
          };
          storage.addRule(rule);
        }),
      );

      await Promise.all(promises);
      const allRules = storage.getRulesByCategory();
      expect(allRules).toHaveLength(10);
    });
  });
});
