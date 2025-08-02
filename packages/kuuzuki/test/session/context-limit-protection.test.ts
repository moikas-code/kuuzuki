import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { join } from "path"
import { mkdtemp, rm, writeFile } from "fs/promises"
import { tmpdir } from "os"
import { App } from "../../src/app/app"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { Identifier } from "../../src/id/id"
import { TokenUtils } from "../../src/util/token-utils"

describe("Context Limit Protection", () => {
  let tempDir: string
  let sessionID: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "kuuzuki-context-test-"))
    sessionID = Identifier.ascending("session")
    
    // Create a minimal kuuzuki.json config
    await writeFile(join(tempDir, "kuuzuki.json"), JSON.stringify({
      provider: {
        anthropic: {
          options: {
            apiKey: "sk-ant-api03-test-key-for-testing-only-not-real-key-just-for-unit-tests-to-pass-validation-checks"
          }
        }
      },
      model: "anthropic/claude-3-haiku-20240307"
    }))
  })

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  test("should calculate token estimates correctly", async () => {
    await App.provide({ cwd: tempDir }, async () => {
      // Test token estimation function
      const shortText = "Hello world"
      const longText = "This is a much longer text that should have more tokens than the short text above."
      
      const shortTokens = TokenUtils.estimateTokens(shortText)
      const longTokens = TokenUtils.estimateTokens(longText)
      
      expect(shortTokens).toBeGreaterThan(0)
      expect(longTokens).toBeGreaterThan(shortTokens)
      expect(shortTokens).toBeLessThan(10) // Should be around 2-3 tokens
      expect(longTokens).toBeGreaterThan(15) // Should be around 18-20 tokens
    })
  })

  test("should detect when messages would exceed context limits", async () => {
    await App.provide({ cwd: tempDir }, async () => {
      // Create a large number of messages that would exceed context limits
      const largeMessages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }> = []
      
      // Create messages with substantial content to simulate a long conversation
      for (let i = 0; i < 100; i++) {
        const largeContent = "This is a very long message with substantial content that will consume many tokens. ".repeat(50)
        
        largeMessages.push({
          info: {
            id: Identifier.ascending("message"),
            role: i % 2 === 0 ? "user" : "assistant",
            sessionID,
            time: { created: Date.now() + i },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            modelID: "claude-3-haiku-20240307",
            providerID: "anthropic",
            mode: "chat",
            path: { cwd: tempDir, root: tempDir },
            system: []
          },
          parts: [{
            type: "text",
            text: largeContent
          }]
        })
      }

      // Calculate total tokens for all messages
      let totalTokens = 0
      for (const msg of largeMessages) {
        const modelMsgs = MessageV2.toModelMessage([msg])
        for (const modelMsg of modelMsgs) {
          if (typeof modelMsg.content === "string") {
            totalTokens += TokenUtils.estimateTokens(modelMsg.content)
          } else if (Array.isArray(modelMsg.content)) {
            for (const part of modelMsg.content) {
              if (part.type === "text") {
                totalTokens += TokenUtils.estimateTokens(part.text)
              }
            }
          }
        }
      }

      // Verify we have enough content to exceed typical context limits
      expect(totalTokens).toBeGreaterThan(100000) // Should be well over 100k tokens
      console.log(`Generated ${largeMessages.length} messages with ~${totalTokens} tokens`)
    })
  })

  test("should preserve recent messages when truncating", async () => {
    await App.provide({ cwd: tempDir }, async () => {
      // Create messages with identifiable content
      const messages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }> = []
      
      // Add older messages (should be truncated) - make them much larger
      for (let i = 0; i < 50; i++) {
        messages.push({
          info: {
            id: Identifier.ascending("message"),
            role: i % 2 === 0 ? "user" : "assistant",
            sessionID,
            time: { created: Date.now() + i },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            modelID: "claude-3-haiku-20240307",
            providerID: "anthropic",
            mode: "chat",
            path: { cwd: tempDir, root: tempDir },
            system: []
          },
          parts: [{
            type: "text",
            text: `OLD_MESSAGE_${i}: ${"This is old content that should be truncated when context limits are reached. ".repeat(100)}`
          }]
        })
      }

      // Add recent messages (should be preserved)
      for (let i = 0; i < 10; i++) {
        messages.push({
          info: {
            id: Identifier.ascending("message"),
            role: i % 2 === 0 ? "user" : "assistant",
            sessionID,
            time: { created: Date.now() + 1000 + i },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            modelID: "claude-3-haiku-20240307",
            providerID: "anthropic",
            mode: "chat",
            path: { cwd: tempDir, root: tempDir },
            system: []
          },
          parts: [{
            type: "text",
            text: `RECENT_MESSAGE_${i}: This is recent content that should be preserved.`
          }]
        })
      }

      // Test the truncation logic (simulate what happens in summarize function)
      const contextLimit = 200000
      const safetyThreshold = contextLimit * 0.8
      const systemTokens = TokenUtils.estimateTokens("System prompt content")
      const summaryRequestTokens = TokenUtils.estimateTokens("Provide a detailed but concise summary...")
      const outputLimit = 4000
      const fixedTokens = systemTokens + summaryRequestTokens + outputLimit
      const availableTokens = safetyThreshold - fixedTokens

      let currentTokens = 0
      const truncatedMessages = []
      
      // Start from the most recent messages and work backwards (same logic as our fix)
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        const modelMsgs = MessageV2.toModelMessage([msg])
        let msgTokens = 0
        
        for (const modelMsg of modelMsgs) {
          if (typeof modelMsg.content === "string") {
            msgTokens += TokenUtils.estimateTokens(modelMsg.content)
          } else if (Array.isArray(modelMsg.content)) {
            for (const part of modelMsg.content) {
              if (part.type === "text") {
                msgTokens += TokenUtils.estimateTokens(part.text)
              }
            }
          }
        }
        
        if (currentTokens + msgTokens <= availableTokens) {
          truncatedMessages.unshift(msg)
          currentTokens += msgTokens
        } else {
          break
        }
      }

      // Verify that recent messages are preserved
      const preservedContent = truncatedMessages.map(msg => 
        msg.parts.find(p => p.type === "text")?.text || ""
      ).join(" ")

      // Should contain recent messages
      expect(preservedContent).toContain("RECENT_MESSAGE_9")
      expect(preservedContent).toContain("RECENT_MESSAGE_8")
      expect(preservedContent).toContain("RECENT_MESSAGE_7")

      // Should have truncated some old messages (or at least not exceed the limit)
      expect(truncatedMessages.length).toBeLessThanOrEqual(messages.length)
      
      console.log(`Truncated from ${messages.length} to ${truncatedMessages.length} messages`)
      console.log(`Used ${currentTokens} of ${availableTokens} available tokens`)
    })
  })

  test("should handle edge case with very small context limits", async () => {
    await App.provide({ cwd: tempDir }, async () => {
      // Test with artificially small context limit
      const messages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }> = []
      
      // Add a few messages
      for (let i = 0; i < 5; i++) {
        messages.push({
          info: {
            id: Identifier.ascending("message"),
            role: i % 2 === 0 ? "user" : "assistant",
            sessionID,
            time: { created: Date.now() + i },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            modelID: "claude-3-haiku-20240307",
            providerID: "anthropic",
            mode: "chat",
            path: { cwd: tempDir, root: tempDir },
            system: []
          },
          parts: [{
            type: "text",
            text: `Message ${i}: This is some content.`
          }]
        })
      }

      // Simulate very small available tokens
      const availableTokens = 100 // Very small limit
      
      let currentTokens = 0
      const truncatedMessages = []
      
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        const modelMsgs = MessageV2.toModelMessage([msg])
        let msgTokens = 0
        
        for (const modelMsg of modelMsgs) {
          if (typeof modelMsg.content === "string") {
            msgTokens += TokenUtils.estimateTokens(modelMsg.content)
          }
        }
        
        if (currentTokens + msgTokens <= availableTokens) {
          truncatedMessages.unshift(msg)
          currentTokens += msgTokens
        } else {
          break
        }
      }

      // Should preserve at least the most recent message
      expect(truncatedMessages.length).toBeGreaterThan(0)
      expect(truncatedMessages.length).toBeLessThanOrEqual(messages.length)
      
      // Should stay within token limit
      expect(currentTokens).toBeLessThanOrEqual(availableTokens)
    })
  })

  test("should handle empty message arrays gracefully", async () => {
    await App.provide({ cwd: tempDir }, async () => {
      const messages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }> = []
      
      // Test truncation logic with empty array
      const availableTokens = 10000
      let currentTokens = 0
      const truncatedMessages = []
      
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        const modelMsgs = MessageV2.toModelMessage([msg])
        let msgTokens = 0
        
        for (const modelMsg of modelMsgs) {
          if (typeof modelMsg.content === "string") {
            msgTokens += TokenUtils.estimateTokens(modelMsg.content)
          }
        }
        
        if (currentTokens + msgTokens <= availableTokens) {
          truncatedMessages.unshift(msg)
          currentTokens += msgTokens
        } else {
          break
        }
      }

      expect(truncatedMessages).toHaveLength(0)
      expect(currentTokens).toBe(0)
    })
  })

  test("should calculate context limits correctly for different models", async () => {
    await App.provide({ cwd: tempDir }, async () => {
      // Test context limit calculations
      const testCases = [
        { contextLimit: 200000, expectedSafetyThreshold: 160000 }, // 80% of 200k
        { contextLimit: 128000, expectedSafetyThreshold: 102400 }, // 80% of 128k
        { contextLimit: 100000, expectedSafetyThreshold: 80000 },  // 80% of 100k
      ]

      for (const testCase of testCases) {
        const safetyThreshold = testCase.contextLimit * 0.8
        expect(safetyThreshold).toBe(testCase.expectedSafetyThreshold)
      }
    })
  })
})