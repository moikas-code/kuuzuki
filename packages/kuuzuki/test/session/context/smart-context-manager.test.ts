import { describe, test, expect, beforeEach } from "bun:test"
import { SmartContextManager } from "../../../src/session/context/SmartContextManager"
import { MessageV2 } from "../../../src/session/message-v2"
import { Identifier } from "../../../src/id/id"
import { ContextCompactionOptions, TaskPriority, MessageImportance } from "../../../src/session/context/types"

describe("SmartContextManager", () => {
  let contextManager: SmartContextManager
  let sessionID: string

  beforeEach(() => {
    contextManager = new SmartContextManager()
    sessionID = Identifier.ascending("session")
  })

  function createTestMessage(
    role: "user" | "assistant",
    text: string,
    timestamp?: number,
  ): { info: MessageV2.Info; parts: MessageV2.Part[] } {
    return {
      info: {
        id: Identifier.ascending("message"),
        role,
        sessionID,
        time: { created: timestamp || Date.now() },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        modelID: "claude-3-haiku-20240307",
        providerID: "anthropic",
        mode: "chat",
        path: { cwd: "/tmp", root: "/tmp" },
        system: [],
      },
      parts: [
        {
          id: Identifier.ascending("part"),
          sessionID,
          messageID: Identifier.ascending("message"),
          type: "text",
          text,
          time: { start: Date.now() },
        },
      ],
    }
  }

  function createDefaultOptions(): ContextCompactionOptions {
    return {
      maxTokens: 1000,
      safetyMargin: 0.85,
      preserveTaskContext: true,
      preserveToolOutputs: true,
      preserveErrors: true,
      minRecentMessages: 3,
      taskContinuationPrompts: true,
    }
  }

  describe("Basic Functionality", () => {
    test("should handle empty message array", async () => {
      const result = await contextManager.compactContext([], createDefaultOptions())

      expect(result.trimmedMessages).toHaveLength(0)
      expect(result.tokensRemoved).toBe(0)
      expect(result.preservationRatio).toBe(1.0)
      expect(result.compactionStrategy).toBe("no-compaction-needed")
    })

    test("should not compact when under token limit", async () => {
      const messages = [createTestMessage("user", "Hello"), createTestMessage("assistant", "Hi there!")]

      const result = await contextManager.compactContext(messages, createDefaultOptions())

      expect(result.trimmedMessages).toHaveLength(2)
      expect(result.tokensRemoved).toBe(0)
      expect(result.preservationRatio).toBe(1.0)
      expect(result.compactionStrategy).toBe("no-compaction-needed")
    })

    test("should compact when over token limit", async () => {
      const longText = "This is a very long message that will consume many tokens. ".repeat(50)
      const messages = [
        createTestMessage("user", longText),
        createTestMessage("assistant", longText),
        createTestMessage("user", longText),
        createTestMessage("assistant", longText),
      ]

      const options = { ...createDefaultOptions(), maxTokens: 100 }
      const result = await contextManager.compactContext(messages, options)

      expect(result.trimmedMessages.length).toBeLessThan(4)
      expect(result.tokensRemoved).toBeGreaterThan(0)
      expect(result.preservationRatio).toBeLessThan(1.0)
    })
  })

  describe("Task Detection and Preservation", () => {
    test("should detect and preserve task-defining messages", async () => {
      const messages = [
        createTestMessage("user", "Please help me with these tasks: 1. Analyze code 2. Fix bugs 3. Write tests"),
        createTestMessage("assistant", "I'll help you with those tasks. Let me start with analyzing the code."),
        createTestMessage("user", "Random chat message"),
        createTestMessage("assistant", "Random response"),
        createTestMessage("user", "Another random message"),
      ]

      const options = { ...createDefaultOptions(), maxTokens: 200 }
      const result = await contextManager.compactContext(messages, options)

      // Should preserve the task-defining message
      const preservedTexts = result.trimmedMessages.map((m) => m.parts.find((p) => p.type === "text")?.text || "")

      expect(preservedTexts.some((text) => text.includes("Please help me with these tasks"))).toBe(true)
      expect(result.preservedTasks.length).toBeGreaterThan(0)
    })

    test("should generate continuation prompts for incomplete tasks", async () => {
      const messages = [
        createTestMessage("user", "I need you to: 1. Read file.ts 2. Analyze the code 3. Suggest improvements"),
        createTestMessage("assistant", "I'll help you with that. Let me read the file first."),
        createTestMessage("assistant", "I've read the file. Here's my analysis..."),
      ]

      const options = { ...createDefaultOptions(), maxTokens: 100 }
      const result = await contextManager.compactContext(messages, options)

      expect(result.continuationPrompt).toBeTruthy()
      expect(result.continuationPrompt).toContain("remaining tasks")
    })

    test("should track task progress correctly", async () => {
      const messages = [
        createTestMessage("user", "Please: 1. Create a function 2. Write tests 3. Document it"),
        createTestMessage("assistant", "I'll create the function first."),
        createTestMessage("assistant", "Here's the function I created: function test() {}"),
        createTestMessage("assistant", "Now I'll write tests for it."),
      ]

      const options = createDefaultOptions()
      const result = await contextManager.compactContext(messages, options)

      expect(result.preservedTasks.length).toBeGreaterThan(0)
      const task = result.preservedTasks[0]
      expect(task.completed.length).toBeGreaterThan(0) // Should have some completed subtasks
    })
  })

  describe("Message Classification and Prioritization", () => {
    test("should preserve error messages", async () => {
      const messages = [
        createTestMessage("user", "Run the tests"),
        createTestMessage("assistant", "Error: Test failed with syntax error"),
        createTestMessage("user", "Random message"),
        createTestMessage("assistant", "Random response"),
      ]

      const options = { ...createDefaultOptions(), maxTokens: 100 }
      const result = await contextManager.compactContext(messages, options)

      const preservedTexts = result.trimmedMessages.map((m) => m.parts.find((p) => p.type === "text")?.text || "")

      expect(preservedTexts.some((text) => text.includes("Error:"))).toBe(true)
    })

    test("should preserve tool outputs", async () => {
      const toolMessage = createTestMessage("assistant", "Tool output: File analysis complete")
      toolMessage.parts.push({
        id: Identifier.ascending("part"),
        sessionID,
        messageID: toolMessage.info.id,
        type: "tool",
        tool: "analyze_file",
        callID: "call_123",
        state: {
          status: "completed",
          title: "File Analysis",
          time: { start: Date.now(), end: Date.now() + 1000 },
          input: { file: "test.ts" },
          output: "Analysis complete",
          metadata: {},
        },
      })

      const messages = [
        createTestMessage("user", "Analyze the file"),
        toolMessage,
        createTestMessage("user", "Random message"),
        createTestMessage("assistant", "Random response"),
      ]

      const options = { ...createDefaultOptions(), maxTokens: 150 }
      const result = await contextManager.compactContext(messages, options)

      // Should preserve the tool output message
      const hasToolOutput = result.trimmedMessages.some((m) => m.parts.some((p) => p.type === "tool"))
      expect(hasToolOutput).toBe(true)
    })

    test("should prioritize recent messages", async () => {
      const now = Date.now()
      const messages = [
        createTestMessage("user", "Old message 1", now - 3600000), // 1 hour ago
        createTestMessage("assistant", "Old response 1", now - 3500000),
        createTestMessage("user", "Recent message 1", now - 60000), // 1 minute ago
        createTestMessage("assistant", "Recent response 1", now - 30000),
        createTestMessage("user", "Recent message 2", now - 10000),
      ]

      const options = { ...createDefaultOptions(), maxTokens: 100 }
      const result = await contextManager.compactContext(messages, options)

      // Should preserve more recent messages
      const preservedTimes = result.trimmedMessages.map((m) => m.info.time.created || 0)
      const averageTime = preservedTimes.reduce((sum, time) => sum + time, 0) / preservedTimes.length

      expect(averageTime).toBeGreaterThan(now - 300000) // Should be relatively recent
    })
  })

  describe("Context Metrics", () => {
    test("should calculate accurate context metrics", async () => {
      const messages = [
        createTestMessage("user", "Please help me: 1. Task one 2. Task two"),
        createTestMessage("assistant", "Error: Something went wrong"),
        createTestMessage("user", "Regular message"),
        createTestMessage("assistant", "Regular response"),
      ]

      const metrics = contextManager.getContextMetrics(messages)

      expect(metrics.totalMessages).toBe(4)
      expect(metrics.totalTokens).toBeGreaterThan(0)
      expect(metrics.taskMessages).toBeGreaterThan(0)
      expect(metrics.errorMessages).toBe(1)
      expect(metrics.averageImportance).toBeGreaterThan(0)
    })
  })

  describe("Performance and Edge Cases", () => {
    test("should handle large message arrays efficiently", async () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createTestMessage(i % 2 === 0 ? "user" : "assistant", `Message ${i}`),
      )

      const startTime = Date.now()
      const result = await contextManager.compactContext(messages, createDefaultOptions())
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1 second
      expect(result.trimmedMessages.length).toBeLessThan(100)
    })

    test("should handle messages with no text content", async () => {
      const emptyMessage = createTestMessage("user", "")
      emptyMessage.parts = [] // No parts

      const messages = [emptyMessage, createTestMessage("assistant", "Valid response")]

      const result = await contextManager.compactContext(messages, createDefaultOptions())

      expect(result.trimmedMessages.length).toBeGreaterThan(0)
      expect(result.preservationRatio).toBeGreaterThan(0)
    })

    test("should handle extreme token limits", async () => {
      const messages = [createTestMessage("user", "Short"), createTestMessage("assistant", "Also short")]

      // Very low token limit
      const options = { ...createDefaultOptions(), maxTokens: 1 }
      const result = await contextManager.compactContext(messages, options)

      expect(result.trimmedMessages.length).toBeGreaterThanOrEqual(0)
      expect(result.preservationRatio).toBeGreaterThanOrEqual(0)
    })
  })

  describe("Integration with Your Test Case", () => {
    test("should handle your 10-point analysis request", async () => {
      const userRequest = `Please help me analyze and refactor this large codebase. I need you to:

1. Read all the TypeScript files in the src/ directory
2. Analyze the code structure and patterns
3. Identify potential bugs and issues
4. Suggest improvements for each file
5. Create a comprehensive refactoring plan
6. Generate detailed documentation for each module
7. Review the test files and suggest additional tests
8. Analyze dependencies and suggest optimizations
9. Create a migration guide for any breaking changes
10. Provide performance optimization recommendations`

      const messages = [
        createTestMessage("user", userRequest),
        createTestMessage(
          "assistant",
          "I'll help you with this comprehensive analysis. Let me start by reading the TypeScript files...",
        ),
        // Simulate file reading responses
        ...Array.from({ length: 10 }, (_, i) =>
          createTestMessage(
            "assistant",
            `File analysis ${i + 1}: Here's the analysis of file${i + 1}.ts...`.repeat(20),
          ),
        ),
      ]

      const options = { ...createDefaultOptions(), maxTokens: 2000 }
      const result = await contextManager.compactContext(messages, options)

      // Should preserve the original request
      const preservedTexts = result.trimmedMessages.map((m) => m.parts.find((p) => p.type === "text")?.text || "")

      expect(preservedTexts.some((text) => text.includes("10. Provide performance optimization"))).toBe(true)
      expect(result.continuationPrompt).toBeTruthy()
      expect(result.continuationPrompt).toContain("remaining tasks")
      expect(result.preservedTasks.length).toBeGreaterThan(0)

      // Should have detected the 10 subtasks
      const task = result.preservedTasks[0]
      expect(task.subtasks.length).toBeGreaterThanOrEqual(8) // Should detect most of the 10 tasks
    })
  })
})
