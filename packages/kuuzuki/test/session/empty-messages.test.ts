import { describe, test, expect } from "bun:test"
import { MessageV2 } from "../../src/session/message-v2"

describe("Empty Messages Prevention", () => {
  test("MessageV2.toModelMessage should handle empty parts gracefully", () => {
    const messagesWithEmptyParts = [
      {
        info: {
          id: "test-1",
          role: "user" as const,
          sessionID: "test-session",
          time: { created: Date.now() },
        },
        parts: [], // Empty parts array
      },
      {
        info: {
          id: "test-2",
          role: "user" as const,
          sessionID: "test-session",
          time: { created: Date.now() },
        },
        parts: [
          {
            id: "part-1",
            messageID: "test-2",
            sessionID: "test-session",
            type: "text" as const,
            text: "Hello world",
          },
        ],
      },
    ]

    const result = MessageV2.toModelMessage(messagesWithEmptyParts)

    // Should only return the message with content, skip empty parts
    expect(result.length).toBe(1)
    expect(result[0].role).toBe("user")
    expect(JSON.stringify(result[0].content)).toContain("Hello world")
  })

  test("MessageV2.toModelMessage should handle all empty parts", () => {
    const allEmptyMessages = [
      {
        info: {
          id: "test-1",
          role: "user" as const,
          sessionID: "test-session",
          time: { created: Date.now() },
        },
        parts: [],
      },
      {
        info: {
          id: "test-2",
          role: "assistant" as const,
          sessionID: "test-session",
          time: { created: Date.now() },
          system: [],
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: "test-model",
          providerID: "test-provider",
          mode: "build",
          path: { cwd: "/test", root: "/test" },
        },
        parts: [],
      },
    ]

    const result = MessageV2.toModelMessage(allEmptyMessages)

    // Should return empty array when all messages have empty parts
    expect(result.length).toBe(0)
  })

  test("MessageV2.toModelMessage should handle mixed content types", () => {
    const mixedMessages = [
      {
        info: {
          id: "test-1",
          role: "user" as const,
          sessionID: "test-session",
          time: { created: Date.now() },
        },
        parts: [
          {
            id: "part-1",
            messageID: "test-1",
            sessionID: "test-session",
            type: "text" as const,
            text: "Text content",
          },
          {
            id: "part-2",
            messageID: "test-1",
            sessionID: "test-session",
            type: "file" as const,
            filename: "test.txt",
            mime: "text/plain",
            url: "file://test.txt",
          },
        ],
      },
    ]

    const result = MessageV2.toModelMessage(mixedMessages)

    expect(result.length).toBe(1)
    expect(result[0].role).toBe("user")
    // Should include text content but skip text/plain files
    expect(JSON.stringify(result[0].content)).toContain("Text content")
  })

  test("should handle empty input array", () => {
    const result = MessageV2.toModelMessage([])
    expect(result.length).toBe(0)
  })

  test("should handle messages with only whitespace text", () => {
    const whitespaceMessages = [
      {
        info: {
          id: "test-1",
          role: "user" as const,
          sessionID: "test-session",
          time: { created: Date.now() },
        },
        parts: [
          {
            id: "part-1",
            messageID: "test-1",
            sessionID: "test-session",
            type: "text" as const,
            text: "   \n\t  ", // Only whitespace
          },
        ],
      },
    ]

    const result = MessageV2.toModelMessage(whitespaceMessages)

    // Should still include the message even if it's just whitespace
    // The AI API can handle whitespace-only messages
    expect(result.length).toBe(1)
    expect(result[0].role).toBe("user")
  })
})
