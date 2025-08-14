import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { ContextAwareRuleActivator } from "./context-aware-rule-activator";
import { MemoryStorage } from "./memory-storage";
import * as fs from "fs";
import * as path from "path";

describe("ContextAwareRuleActivator", () => {
  let storage: MemoryStorage;
  let testDbPath: string;

  beforeEach(() => {
    // Create isolated test database
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    testDbPath = path.join(
      process.cwd(),
      ".kuuzuki-test",
      `context-test-${timestamp}-${random}.db`,
    );
    const testDir = path.dirname(testDbPath);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    storage = MemoryStorage.createTestInstance(testDbPath);

    // Add some test rules
    storage.addRule({
      id: "test-rule-1",
      text: "Always use TypeScript strict mode",
      category: "critical",
      reason: "Prevents runtime type errors",
      analytics: JSON.stringify({ effectivenessScore: 0.9 }),
      documentationLinks: JSON.stringify([]),
      tags: JSON.stringify(["typescript", "strict"]),
    });

    storage.addRule({
      id: "test-rule-2", 
      text: "Prefer const over let",
      category: "preferred",
      reason: "Immutability is better",
      analytics: JSON.stringify({ effectivenessScore: 0.7 }),
      documentationLinks: JSON.stringify([]),
      tags: JSON.stringify(["javascript", "variables"]),
    });
  });

  afterEach(() => {
    storage.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    (MemoryStorage as any).instance = null;
  });

  test("should analyze context successfully", async () => {
    const mockCtx = {
      sessionID: "test-session",
      messageID: "test-message", 
      toolCallID: "test-call",
      abort: new AbortController().signal,
      metadata: () => {},
    };

    const result = await ContextAwareRuleActivator.init().then(tool => 
      tool.execute({
        action: "analyze_context",
        context: {
          currentFiles: ["test.ts", "app.js"],
          recentCommands: ["npm test", "git commit"],
          taskType: "coding" as const,
        }
      }, mockCtx)
    );

    expect(result.title).toContain("analyze_context");
    expect(result.metadata.action).toBe("analyze_context");
    
    const analysis = result.metadata.result;
    expect(analysis).toHaveProperty("projectType");
    expect(analysis).toHaveProperty("taskType");
    expect(analysis).toHaveProperty("complexity");
  });

  test("should prioritize rules based on context", async () => {
    const mockCtx = {
      sessionID: "test-session",
      messageID: "test-message",
      toolCallID: "test-call", 
      abort: new AbortController().signal,
      metadata: () => {},
    };

    const result = await ContextAwareRuleActivator.init().then(tool =>
      tool.execute({
        action: "prioritize_rules",
        context: {
          currentFiles: ["test.ts"],
          taskType: "coding" as const,
        },
        maxRules: 5,
        minConfidence: 0.3,
      }, mockCtx)
    );

    expect(result.title).toContain("prioritize_rules");
    expect(result.metadata.action).toBe("prioritize_rules");
    
    const priorities = result.metadata.result;
    expect(Array.isArray(priorities)).toBe(true);
    
    if (priorities.length > 0) {
      expect(priorities[0]).toHaveProperty("ruleId");
      expect(priorities[0]).toHaveProperty("priority");
      expect(priorities[0]).toHaveProperty("confidence");
    }
  });

  test("should get active rules with context", async () => {
    const mockCtx = {
      sessionID: "test-session",
      messageID: "test-message",
      toolCallID: "test-call",
      abort: new AbortController().signal, 
      metadata: () => {},
    };

    const result = await ContextAwareRuleActivator.init().then(tool =>
      tool.execute({
        action: "get_active_rules",
        context: {
          currentFiles: ["test.ts"],
          taskType: "coding" as const,
        },
        includeReasons: true,
      }, mockCtx)
    );

    expect(result.title).toContain("get_active_rules");
    expect(result.metadata.action).toBe("get_active_rules");
    
    const activeRules = result.metadata.result;
    expect(activeRules).toHaveProperty("totalRules");
    expect(activeRules).toHaveProperty("activeRules");
    expect(Array.isArray(activeRules.activeRules)).toBe(true);
  });

  test("should update and retrieve context history", async () => {
    const mockCtx = {
      sessionID: "test-session",
      messageID: "test-message",
      toolCallID: "test-call",
      abort: new AbortController().signal,
      metadata: () => {},
    };

    // Update context
    const updateResult = await ContextAwareRuleActivator.init().then(tool =>
      tool.execute({
        action: "update_context",
        context: {
          currentFiles: ["test.ts"],
          taskType: "coding" as const,
        },
      }, mockCtx)
    );

    expect(updateResult.title).toContain("update_context");
    expect(updateResult.metadata.result.contextUpdated).toBe(true);

    // Get context history
    const historyResult = await ContextAwareRuleActivator.init().then(tool =>
      tool.execute({
        action: "get_context_history",
      }, mockCtx)
    );

    expect(historyResult.title).toContain("get_context_history");
    const history = historyResult.metadata.result;
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    
    if (history.length > 0) {
      expect(history[0]).toHaveProperty("timestamp");
      expect(history[0]).toHaveProperty("context");
      expect(history[0]).toHaveProperty("activatedRules");
    }
  });
});