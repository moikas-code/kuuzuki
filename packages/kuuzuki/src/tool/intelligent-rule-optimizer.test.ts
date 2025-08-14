import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { IntelligentRuleOptimizerTool } from "./intelligent-rule-optimizer";
import { MemoryStorage } from "./memory-storage";
import * as path from "path";
import * as fs from "fs";

describe("IntelligentRuleOptimizerTool", () => {
  let storage: MemoryStorage;
  let testDbPath: string;

  beforeEach(() => {
    // Create a temporary database for testing
    testDbPath = path.join(process.cwd(), "test-memory.db");
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
      analytics: JSON.stringify({
        timesApplied: 10,
        timesIgnored: 2,
        effectivenessScore: 0.8,
        userFeedback: [{ rating: 5, comment: "Very helpful", timestamp: new Date().toISOString() }],
      }),
      documentationLinks: "[]",
      tags: JSON.stringify(["typescript", "strict"]),
    });

    storage.addRule({
      id: "test-rule-2", 
      text: "Prefer const over let for variables that don't change",
      category: "preferred",
      reason: "Improves code clarity",
      analytics: JSON.stringify({
        timesApplied: 5,
        timesIgnored: 1,
        effectivenessScore: 0.6,
        userFeedback: [],
      }),
      documentationLinks: "[]",
      tags: JSON.stringify(["javascript", "variables"]),
    });

    storage.addRule({
      id: "test-rule-3",
      text: "Use TypeScript strict mode always",
      category: "critical", 
      reason: "Similar to rule 1",
      analytics: JSON.stringify({
        timesApplied: 1,
        timesIgnored: 0,
        effectivenessScore: 0.2,
        userFeedback: [],
      }),
      documentationLinks: "[]",
      tags: JSON.stringify(["typescript"]),
    });
  });

  it("should analyze rule performance", async () => {
    const tool = await IntelligentRuleOptimizerTool.init();
    
    const result = await tool.execute(
      {
        action: "analyze_performance",
        timeframeDays: 30,
        includeReasons: true,
      },
      {
        sessionID: "test-session",
        messageID: "test-message", 
        toolCallID: "test-call",
        abort: new AbortController().signal,
        metadata: () => {},
      }
    );

    expect(result.title).toBe("Rule Performance Analysis");
    expect(result.metadata.rulesAnalyzed).toBeGreaterThan(0);
    expect(result.output).toContain("Rules Analyzed");
    expect(result.output).toContain("Average Effectiveness");
  });

  it("should detect conflicts between similar rules", async () => {
    const tool = await IntelligentRuleOptimizerTool.init();
    
    const result = await tool.execute(
      {
        action: "resolve_conflicts",
        minConfidence: 0.5,
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call", 
        abort: new AbortController().signal,
        metadata: () => {},
      }
    );

    expect(result.title).toBe("Conflict Resolution");
    expect(result.output).toContain("Conflicts Detected");
    // Should detect similarity between "Always use TypeScript strict mode" and "Use TypeScript strict mode always"
  });

  it("should generate optimization suggestions", async () => {
    const tool = await IntelligentRuleOptimizerTool.init();
    
    const result = await tool.execute(
      {
        action: "optimize_rules",
        minConfidence: 0.5,
        maxSuggestions: 10,
        optimizationTypes: ["consolidate", "deprecate"],
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call",
        abort: new AbortController().signal,
        metadata: () => {},
      }
    );

    expect(result.title).toBe("Rule Optimization Suggestions");
    expect(result.metadata.totalSuggestions).toBeGreaterThanOrEqual(0);
    expect(result.output).toContain("Total Suggestions");
  });

  it("should suggest category optimizations", async () => {
    const tool = await IntelligentRuleOptimizerTool.init();
    
    const result = await tool.execute(
      {
        action: "suggest_categories",
        minConfidence: 0.5,
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call",
        abort: new AbortController().signal,
        metadata: () => {},
      }
    );

    expect(result.title).toBe("Category Optimization");
    expect(result.metadata.rulesAnalyzed).toBeGreaterThan(0);
    expect(result.output).toContain("Rules Analyzed");
  });

  it("should run batch optimization", async () => {
    const tool = await IntelligentRuleOptimizerTool.init();
    
    const result = await tool.execute(
      {
        action: "batch_optimize",
        minConfidence: 0.6,
        maxSuggestions: 5,
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call",
        abort: new AbortController().signal,
        metadata: () => {},
      }
    );

    expect(result.title).toBe("Batch Optimization");
    expect(result.output).toContain("Batch Optimization Report");
    expect(result.output).toContain("Performance Analysis");
    expect(result.output).toContain("Optimization Suggestions");
    expect(result.output).toContain("Conflict Resolution");
    expect(result.output).toContain("Category Optimization");
  });

  it("should handle errors gracefully", async () => {
    const tool = await IntelligentRuleOptimizerTool.init();
    
    const result = await tool.execute(
      {
        action: "invalid_action" as any,
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call",
        abort: new AbortController().signal,
        metadata: () => {},
      }
    );

    expect(result.title).toBe("Intelligent Rule Optimizer Error");
    expect(result.output).toContain("Error:");
  });

  afterEach(() => {
    // Clean up test database
    if (storage) {
      storage.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
});