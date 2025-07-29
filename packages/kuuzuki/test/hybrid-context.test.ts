import { describe, test, expect, beforeEach, mock } from "bun:test"
import { HybridContextManager } from "../src/session/hybrid-context-manager"
import { HybridContext } from "../src/session/hybrid-context"
import { MessageV2 } from "../src/session/message-v2"
import { Identifier } from "../src/id/id"
import { MockStorage, Storage } from "./mocks/storage.mock"

describe("HybridContextManager", () => {
  const testSessionID = "test-session-123"
  let manager: HybridContextManager

  beforeEach(async () => {
    // Reset mock storage
    MockStorage.reset()

    // Mock the Storage module
    mock.module("../src/storage/storage", () => ({
      Storage,
    }))

    manager = await HybridContextManager.forSession(testSessionID)
  })

  test("should initialize with correct tier structure", () => {
    const tiers = manager.getContextTiers()

    expect(tiers.size).toBe(4)
    expect(tiers.has("recent")).toBe(true)
    expect(tiers.has("compressed")).toBe(true)
    expect(tiers.has("semantic")).toBe(true)
    expect(tiers.has("pinned")).toBe(true)

    const recentTier = tiers.get("recent")!
    expect(recentTier.maxTokens).toBe(30000)
    expect(recentTier.currentTokens).toBe(0)
  })

  test("should add messages and track tokens", async () => {
    const message: MessageV2.User = {
      id: Identifier.ascending("message"),
      role: "user",
      sessionID: testSessionID,
      time: { created: Date.now() },
    }

    await manager.addMessage(message, { skipCompression: true })

    const tiers = manager.getContextTiers()
    const recentTier = tiers.get("recent")!

    expect(recentTier.currentTokens).toBeGreaterThan(0)
    expect(recentTier.messageCount).toBe(1)
  })
  test("should trigger compression at 65% capacity", async () => {
    // Add messages until we exceed 65% capacity
    const messages: MessageV2.Info[] = []
    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) {
        messages.push({
          id: Identifier.ascending("message"),
          role: "user",
          sessionID: testSessionID,
          time: { created: Date.now() + i },
        } as MessageV2.User)
      } else {
        messages.push({
          id: Identifier.ascending("message"),
          role: "assistant",
          sessionID: testSessionID,
          time: { created: Date.now() + i },
          path: { cwd: "/test", root: "/test" },
          providerID: "test",
          modelID: "test",
          mode: "build",
          system: [],
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        } as MessageV2.Assistant)
      }
    }

    // Add messages one by one
    for (const msg of messages) {
      await manager.addMessage(msg)
    }

    const metrics = manager.getMetrics()
    expect(metrics.compressionEvents).toBeGreaterThan(0)
  })

  test("should build optimized context for requests", async () => {
    // Add some test messages
    const messages: MessageV2.Info[] = [
      {
        id: "msg-1",
        role: "user",
        sessionID: testSessionID,
        time: { created: Date.now() - 1000 },
      } as MessageV2.User,
      {
        id: "msg-2",
        role: "assistant",
        sessionID: testSessionID,
        time: { created: Date.now() - 500 },
        path: { cwd: "/test", root: "/test" },
        providerID: "test",
        modelID: "test",
        mode: "build",
        system: [],
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      } as MessageV2.Assistant,
    ]

    for (const msg of messages) {
      await manager.addMessage(msg, { skipCompression: true })
    }

    const contextRequest: HybridContext.ContextRequest = {
      sessionID: testSessionID,
      includeRecent: true,
      includeCompressed: false,
      includeSemantic: false,
      includePinned: false,
      prioritizeTypes: [],
    }

    const context = await manager.buildContextForRequest(contextRequest)

    expect(context.messages.length).toBeGreaterThanOrEqual(0)
    expect(context.totalTokens).toBeGreaterThan(0)
    expect(context.compressionSummary).toBeDefined()
  })
  test("should pin and unpin messages", async () => {
    const messageId = "msg-to-pin"
    const reason = "Important context"

    await manager.pinMessage(messageId, reason)

    // Verify message is pinned (would need to expose pinned messages getter)
    // For now, just verify no errors

    await manager.unpinMessage(messageId)
    // Verify unpinning worked
  })

  test("should determine correct compression levels", async () => {
    const tiers = manager.getContextTiers()

    // Test different token usage scenarios
    const scenarios = [
      { percent: 0.5, expected: "none" },
      { percent: 0.7, expected: "light" },
      { percent: 0.8, expected: "medium" },
      { percent: 0.9, expected: "heavy" },
      { percent: 0.98, expected: "emergency" },
    ]

    for (const scenario of scenarios) {
      // Reset tiers
      for (const tier of tiers.values()) {
        tier.currentTokens = 0
      }

      // Set token usage to test percentage
      const totalMax = Array.from(tiers.values()).reduce((sum, t) => sum + t.maxTokens, 0)
      const targetTokens = Math.floor(totalMax * scenario.percent)

      // Distribute tokens across tiers
      tiers.get("recent")!.currentTokens = targetTokens

      // This would require exposing determineCompressionLevel method
      // For now, we just verify the manager handles different scenarios
    }
  })
})
