import { describe, it, expect } from "bun:test"
import { TaskAwareCompression } from "../src/session/task-aware-compression"
import { MessageV2 } from "../src/session/message-v2"

describe("TaskAwareCompression", () => {
  const createMockUserMessage = (id: string): MessageV2.User => ({
    id,
    sessionID: "session1",
    role: "user",
    time: { created: Date.now() },
  })

  const createMockAssistantMessage = (id: string): MessageV2.Assistant => ({
    id,
    sessionID: "session1",
    role: "assistant",
    time: { created: Date.now() },
    path: { cwd: "/test", root: "/test" },
    providerID: "test",
    system: [],
    modelID: "test",
    mode: "test",
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  })

  describe("analyzeTaskSession", () => {
    it("should identify task sessions with todo tool usage", () => {
      const messages = [createMockUserMessage("msg1"), createMockAssistantMessage("msg2")]

      // Mock JSON.stringify to simulate todo tool usage
      const originalStringify = JSON.stringify
      JSON.stringify = (obj: any) => {
        if (obj === messages[0]) return "todowrite usage here"
        if (obj === messages[1]) return "todoread and more todowrite calls"
        return originalStringify(obj)
      }

      const analysis = TaskAwareCompression.analyzeTaskSession(messages)

      expect(analysis.isTaskSession).toBe(true)
      expect(analysis.taskScore).toBeGreaterThan(0)
      expect(analysis.indicators.todoToolUsage).toBeGreaterThan(0)

      // Restore original stringify
      JSON.stringify = originalStringify
    })

    it("should identify non-task sessions", () => {
      const messages = [createMockUserMessage("msg1"), createMockAssistantMessage("msg2")]

      const analysis = TaskAwareCompression.analyzeTaskSession(messages)

      expect(analysis.isTaskSession).toBe(false)
      expect(analysis.taskScore).toBeLessThan(3)
    })
  })

  describe("extractTaskSemanticFacts", () => {
    it("should extract todo items as semantic facts", () => {
      const messages = [createMockUserMessage("msg1")]

      // Mock JSON.stringify to simulate todo content
      const originalStringify = JSON.stringify
      JSON.stringify = (obj: any) => {
        if (obj === messages[0]) {
          return JSON.stringify({
            todos: [
              { content: "Fix the bug", status: "in_progress", priority: "high" },
              { content: "Write tests", status: "pending", priority: "medium" },
            ],
          })
        }
        return originalStringify(obj)
      }

      const facts = TaskAwareCompression.extractTaskSemanticFacts(messages)

      expect(facts.length).toBeGreaterThan(0)
      expect(facts.some((f) => f.content.includes("Fix the bug"))).toBe(true)
      expect(facts.some((f) => f.content.includes("in_progress"))).toBe(true)

      // Restore original stringify
      JSON.stringify = originalStringify
    })

    it("should extract task decisions", () => {
      const messages = [createMockUserMessage("msg1")]

      // Mock JSON.stringify to simulate decision content
      const originalStringify = JSON.stringify
      JSON.stringify = (obj: any) => {
        if (obj === messages[0]) {
          return "I decided to use React for this component. Will implement it next."
        }
        return originalStringify(obj)
      }

      const facts = TaskAwareCompression.extractTaskSemanticFacts(messages)

      expect(facts.length).toBeGreaterThan(0)
      expect(facts.some((f) => f.type === "decision")).toBe(true)

      // Restore original stringify
      JSON.stringify = originalStringify
    })
  })

  describe("shouldPreserveMessage", () => {
    it("should preserve messages with todo tool usage", () => {
      const message = createMockUserMessage("msg1")

      // Mock JSON.stringify to simulate todo tool usage
      const originalStringify = JSON.stringify
      JSON.stringify = (obj: any) => {
        if (obj === message) return "todowrite call here"
        return originalStringify(obj)
      }

      const result = TaskAwareCompression.shouldPreserveMessage(message, [])

      expect(result.preserve).toBe(true)
      expect(result.reason).toContain("todo tool")
      expect(result.preservationLevel).toBe("full")

      // Restore original stringify
      JSON.stringify = originalStringify
    })

    it("should not preserve regular messages", () => {
      const message = createMockUserMessage("msg1")

      const result = TaskAwareCompression.shouldPreserveMessage(message, [])

      expect(result.preserve).toBe(false)
    })
  })

  describe("getTaskCompressionThresholds", () => {
    it("should return higher thresholds for task sessions", () => {
      const taskThresholds = TaskAwareCompression.getTaskCompressionThresholds(true, 5)
      const regularThresholds = TaskAwareCompression.getTaskCompressionThresholds(false, 0)

      expect(taskThresholds.lightThreshold).toBeGreaterThan(regularThresholds.lightThreshold)
      expect(taskThresholds.mediumThreshold).toBeGreaterThan(regularThresholds.mediumThreshold)
      expect(taskThresholds.heavyThreshold).toBeGreaterThan(regularThresholds.heavyThreshold)
      expect(taskThresholds.emergencyThreshold).toBeGreaterThan(regularThresholds.emergencyThreshold)
    })

    it("should scale thresholds with task score", () => {
      const lowScoreThresholds = TaskAwareCompression.getTaskCompressionThresholds(true, 3)
      const highScoreThresholds = TaskAwareCompression.getTaskCompressionThresholds(true, 7)

      expect(highScoreThresholds.lightThreshold).toBeGreaterThan(lowScoreThresholds.lightThreshold)
    })
  })

  describe("integrateTodoState", () => {
    it("should convert todo state to semantic facts", async () => {
      const todos = [
        { content: "Implement feature", status: "in_progress", priority: "high", id: "todo1" },
        { content: "Write documentation", status: "pending", priority: "low", id: "todo2" },
      ]

      const facts = await TaskAwareCompression.integrateTodoState("session1", todos)

      expect(facts.length).toBe(2)
      expect(facts[0].type).toBe("tool_usage")
      expect(facts[0].content).toContain("Implement feature")
      expect(facts[0].content).toContain("in_progress")
      expect(facts[0].importance).toBe("critical") // high priority -> critical importance
      expect(facts[1].importance).toBe("medium") // low priority -> medium importance
    })
  })
})
