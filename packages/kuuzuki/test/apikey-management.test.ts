import { describe, test, expect, beforeEach } from "bun:test"
import { ApiKeyManager } from "../src/auth/apikey"
import { Providers } from "../src/auth/providers"
import { promises as fs } from "fs"
import { join } from "path"
import { homedir } from "os"

describe("API Key Management", () => {
  const testDir = join(homedir(), ".kuuzuki-test")

  beforeEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
    await fs.mkdir(testDir, { recursive: true })
  })

  describe("Providers", () => {
    test("should validate Anthropic API key format", () => {
      const validKey = "sk-ant-api03-" + "a".repeat(95)
      const invalidKey = "invalid-key"

      expect(Providers.validateProviderKey("anthropic", validKey)).toBe(true)
      expect(Providers.validateProviderKey("anthropic", invalidKey)).toBe(false)
    })

    test("should validate OpenAI API key format", () => {
      const validKey = "sk-" + "a".repeat(48)
      const invalidKey = "invalid-key"

      expect(Providers.validateProviderKey("openai", validKey)).toBe(true)
      expect(Providers.validateProviderKey("openai", invalidKey)).toBe(false)
    })

    test("should mask API keys correctly", () => {
      const anthropicKey = "sk-ant-api03-" + "a".repeat(95)
      const maskedKey = Providers.maskProviderKey("anthropic", anthropicKey)

      expect(maskedKey).toContain("****")
      expect(maskedKey).not.toBe(anthropicKey)
      expect(maskedKey.length).toBeLessThan(anthropicKey.length)
    })

    test("should detect provider from API key", () => {
      const anthropicKey = "sk-ant-api03-" + "a".repeat(95)
      const openaiKey = "sk-" + "a".repeat(48)

      expect(Providers.detectProvider(anthropicKey)).toBe("anthropic")
      expect(Providers.detectProvider(openaiKey)).toBe("openai")
      expect(Providers.detectProvider("invalid")).toBe(null)
    })

    test("should list supported providers", () => {
      const providers = Providers.listSupportedProviders()

      expect(providers.length).toBeGreaterThan(0)
      expect(providers.some((p) => p.id === "anthropic")).toBe(true)
      expect(providers.some((p) => p.id === "openai")).toBe(true)
    })
  })

  describe("ApiKeyManager", () => {
    test("should store and retrieve API keys", async () => {
      const manager = new ApiKeyManager.ApiKeyManager()
      const testKey = "sk-ant-api03-" + "a".repeat(95)

      await manager.storeKey("anthropic", testKey, false)
      const retrievedKey = await manager.getKey("anthropic")

      expect(retrievedKey).toBe(testKey)
      expect(manager.hasKey("anthropic")).toBe(true)
    })

    test("should validate API keys", async () => {
      const manager = new ApiKeyManager.ApiKeyManager()
      const validKey = "sk-ant-api03-" + "a".repeat(95)
      const invalidKey = "invalid-key"

      expect(await manager.validateKey("anthropic", validKey)).toBe(true)
      expect(await manager.validateKey("anthropic", invalidKey)).toBe(false)
    })

    test("should list stored keys", async () => {
      const manager = new ApiKeyManager.ApiKeyManager()
      const testKey = "sk-ant-api03-" + "a".repeat(95)

      await manager.storeKey("anthropic", testKey, false)
      const keys = await manager.listKeys()

      expect(keys.length).toBe(1)
      expect(keys[0].providerId).toBe("anthropic")
      expect(keys[0].maskedKey).toContain("****")
      expect(keys[0].source).toBe("manual")
    })

    test("should remove API keys", async () => {
      const manager = new ApiKeyManager.ApiKeyManager()
      const testKey = "sk-ant-api03-" + "a".repeat(95)

      await manager.storeKey("anthropic", testKey, false)
      expect(manager.hasKey("anthropic")).toBe(true)

      await manager.removeKey("anthropic")
      expect(manager.hasKey("anthropic")).toBe(false)
    })

    test("should detect and store keys automatically", async () => {
      const manager = new ApiKeyManager.ApiKeyManager()
      const testKey = "sk-ant-api03-" + "a".repeat(95)

      const detectedProvider = await manager.detectAndStoreKey(testKey, false)

      expect(detectedProvider).toBe("anthropic")
      expect(manager.hasKey("anthropic")).toBe(true)
    })

    test("should handle invalid API key storage", async () => {
      const manager = new ApiKeyManager.ApiKeyManager()

      await expect(manager.storeKey("anthropic", "invalid-key", false)).rejects.toThrow()
    })
  })

  describe("Environment Variables", () => {
    test("should detect API keys from environment", () => {
      const originalEnv = process.env["ANTHROPIC_API_KEY"]
      const testKey = "sk-ant-api03-" + "a".repeat(95)

      process.env["ANTHROPIC_API_KEY"] = testKey

      const envKey = Providers.getEnvironmentKey("anthropic")
      expect(envKey).toBe(testKey)

      // Restore original environment
      if (originalEnv) {
        process.env["ANTHROPIC_API_KEY"] = originalEnv
      } else {
        delete process.env["ANTHROPIC_API_KEY"]
      }
    })
  })
})
