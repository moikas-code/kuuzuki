import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SmartLearningAssistantTool } from "./smart-learning-assistant";
import { MemoryStorage } from "./memory-storage";
import * as path from "path";
import * as fs from "fs";

describe("SmartLearningAssistantTool", () => {
  let testDbPath: string;
  let storage: MemoryStorage;

  beforeEach(() => {
    // Create a temporary database for testing
    testDbPath = path.join(process.cwd(), ".test-memory.db");
    storage = MemoryStorage.createTestInstance(testDbPath);
  });

  afterEach(() => {
    // Clean up test database
    storage.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it("should initialize and execute analyze_patterns action", async () => {
    const tool = await SmartLearningAssistantTool.init();
    
    const result = await tool.execute(
      {
        action: "analyze_patterns",
        timeframe: "7d",
        minConfidence: 0.5,
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

    // Since we have no behavior data, it should return "No Patterns Found"
    expect(result.title).toBe("No Patterns Found");
    expect(result.metadata).toBeDefined();
    expect(result.output).toContain("No user behavior data found");
  });

  it("should execute suggest_rules action", async () => {
    const tool = await SmartLearningAssistantTool.init();
    
    const result = await tool.execute(
      {
        action: "suggest_rules",
        context: {
          currentFiles: ["src/app.ts"],
          taskType: "coding",
        },
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

    expect(result.title).toBe("Adaptive Rule Suggestions");
    expect(result.metadata).toBeDefined();
    expect(result.output).toContain("Adaptive Rule Suggestions");
  });

  it("should execute record_behavior action", async () => {
    const tool = await SmartLearningAssistantTool.init();
    
    const result = await tool.execute(
      {
        action: "record_behavior",
        behaviorData: {
          actionType: "test_run",
          actionData: { command: "npm test" },
          outcome: "success",
          effectiveness: 0.9,
        },
        context: {
          taskType: "testing",
        },
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call", 
        abort: new AbortController().signal,
        metadata: () => {},
      }
    );

    expect(result.title).toBe("Behavior Recorded");
    expect(result.metadata.actionType).toBe("test_run");
    expect(result.output).toContain("test_run behavior");
  });

  it("should execute provide_feedback action", async () => {
    const tool = await SmartLearningAssistantTool.init();
    
    const result = await tool.execute(
      {
        action: "provide_feedback",
        feedbackData: {
          ruleId: "test-rule-123",
          feedbackType: "positive",
          originalSuggestion: "Test rule for feedback",
        },
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call",
        abort: new AbortController().signal,
        metadata: () => {},
      }
    );

    expect(result.title).toBe("Feedback Recorded");
    expect(result.metadata.ruleId).toBe("test-rule-123");
    expect(result.metadata.feedbackType).toBe("positive");
  });

  it("should execute get_insights action", async () => {
    const tool = await SmartLearningAssistantTool.init();
    
    const result = await tool.execute(
      {
        action: "get_insights",
        minConfidence: 0.5,
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

    expect(result.title).toBe("Learning Insights");
    expect(result.metadata).toBeDefined();
    expect(result.output).toContain("Learning Insights");
  });

  it("should handle invalid action gracefully", async () => {
    const tool = await SmartLearningAssistantTool.init();
    
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

    expect(result.title).toBe("Smart Learning Assistant Error");
    expect(result.output).toContain("Unknown action: invalid_action");
  });
});