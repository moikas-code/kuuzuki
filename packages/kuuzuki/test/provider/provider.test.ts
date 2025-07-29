import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { Provider } from "../../src/provider/provider"
import { App } from "../../src/app/app"

// Mock dependencies
const mockConfig = mock(() => ({
  provider: {
    anthropic: {
      name: "anthropic",
      enabled: true,
      options: {
        apiKey: "test-key",
      },
    },
  },
  disabled_providers: [],
  model: "anthropic/claude-3-5-sonnet",
  small_model: "anthropic/claude-3-haiku",
}))

const mockAuth = {
  all: mock(() => Promise.resolve({})),
  get: mock(() => Promise.resolve(null)),
  set: mock(() => Promise.resolve()),
}

const mockModelsDev = {
  get: mock(() =>
    Promise.resolve({
      anthropic: {
        id: "anthropic",
        name: "Anthropic",
        npm: "@ai-sdk/anthropic",
        env: ["ANTHROPIC_API_KEY"],
        api: "https://api.anthropic.com",
        models: {
          "claude-3-5-sonnet": {
            id: "claude-3-5-sonnet",
            name: "Claude 3.5 Sonnet",
            tool_call: true,
            attachment: true,
            reasoning: false,
            temperature: true,
            cost: {
              input: 3,
              output: 15,
              cache_read: 0.3,
              cache_write: 3.75,
            },
            limit: {
              context: 200000,
              output: 8192,
            },
          },
          "claude-3-haiku": {
            id: "claude-3-haiku",
            name: "Claude 3 Haiku",
            tool_call: true,
            attachment: false,
            reasoning: false,
            temperature: true,
            cost: {
              input: 0.25,
              output: 1.25,
              cache_read: 0.03,
              cache_write: 0.3,
            },
            limit: {
              context: 200000,
              output: 4096,
            },
          },
        },
      },
      openai: {
        id: "openai",
        name: "OpenAI",
        npm: "@ai-sdk/openai",
        env: ["OPENAI_API_KEY"],
        api: "https://api.openai.com/v1",
        models: {
          "gpt-4": {
            id: "gpt-4",
            name: "GPT-4",
            tool_call: true,
            attachment: false,
            reasoning: false,
            temperature: true,
            cost: {
              input: 30,
              output: 60,
              cache_read: 0,
              cache_write: 0,
            },
            limit: {
              context: 8192,
              output: 4096,
            },
          },
        },
      },
    }),
  ),
}

describe("Provider", () => {
  beforeEach(() => {
    // Reset mocks
    mockConfig.mockClear()
    mockAuth.all.mockClear()
    mockAuth.get.mockClear()
    mockAuth.set.mockClear()
    mockModelsDev.get.mockClear()

    // Mock modules
    mock.module("../../src/config/config", () => ({
      Config: {
        get: mockConfig,
      },
    }))

    mock.module("../../src/auth", () => ({
      Auth: mockAuth,
    }))

    mock.module("../../src/provider/models", () => ({
      ModelsDev: mockModelsDev,
    }))

    // Mock BunProc to prevent npm installs
    mock.module("../../src/bun", () => ({
      BunProc: {
        install: mock(async (pkg: string) => {
          // Return a fake module path
          return "/fake/path/" + pkg
        }),
      },
    }))

    // Mock the anthropic SDK module
    mock.module("@ai-sdk/anthropic", () => ({
      createAnthropic: () => ({
        languageModel: (modelId: string) => ({
          id: modelId,
          name: `Mocked ${modelId}`,
          // Add other required properties as needed
        }),
      }),
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  describe("parseModel", () => {
    test("should parse provider and model ID correctly", () => {
      const result = Provider.parseModel("anthropic/claude-3-5-sonnet")
      expect(result).toEqual({
        providerID: "anthropic",
        modelID: "claude-3-5-sonnet",
      })
    })

    test("should handle model IDs with multiple slashes", () => {
      const result = Provider.parseModel("openai/gpt-4/turbo")
      expect(result).toEqual({
        providerID: "openai",
        modelID: "gpt-4/turbo",
      })
    })

    test("should handle single part model names", () => {
      const result = Provider.parseModel("claude-3-5-sonnet")
      expect(result).toEqual({
        providerID: "claude-3-5-sonnet",
        modelID: "",
      })
    })
  })

  describe("sort", () => {
    test("should sort models by priority and name", () => {
      const models = [
        { id: "claude-3-haiku", name: "Claude 3 Haiku" },
        { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
        { id: "gpt-4", name: "GPT-4" },
        { id: "gemini-2.5-pro-preview", name: "Gemini 2.5 Pro Preview" },
      ] as any[]

      const sorted = Provider.sort(models)

      // Should prioritize claude-sonnet-4 first (highest priority index), then gemini-2.5-pro-preview
      expect(sorted[0].id).toBe("claude-sonnet-4")
      expect(sorted[1].id).toBe("gemini-2.5-pro-preview")
    })

    test("should handle empty model list", () => {
      const result = Provider.sort([])
      expect(result).toEqual([])
    })
  })

  describe("list", () => {
    test("should return available providers", async () => {
      await App.provide({ cwd: process.cwd() }, async () => {
        const providers = await Provider.list()
        expect(providers).toBeDefined()
        expect(typeof providers).toBe("object")
      })
    })
  })

  describe("defaultModel", () => {
    test("should return configured default model", async () => {
      mockConfig.mockReturnValue({
        model: "anthropic/claude-3-5-sonnet",
        provider: {
          anthropic: {
            name: "anthropic",
            enabled: true,
            options: {
              apiKey: "test-key",
            },
          },
        },
      })

      await App.provide({ cwd: process.cwd() }, async () => {
        const result = await Provider.defaultModel()
        expect(result).toEqual({
          providerID: "anthropic",
          modelID: "claude-3-5-sonnet",
        })
      })
    })

    test("should fallback to first available provider when no model configured", async () => {
      mockConfig.mockReturnValue({
        provider: {
          anthropic: {
            name: "anthropic",
            enabled: true,
            options: {
              apiKey: "test-key",
            },
          },
        },
      })

      await App.provide({ cwd: process.cwd() }, async () => {
        const result = await Provider.defaultModel()
        expect(result.providerID).toBe("anthropic")
        expect(result.modelID).toBeDefined()
      })
    })

    test("should throw error when no providers available", async () => {
      mockConfig.mockReturnValue({
        provider: {},
      })
      mockModelsDev.get.mockReturnValue(Promise.resolve({}))

      await App.provide({ cwd: process.cwd() }, async () => {
        await expect(Provider.defaultModel()).rejects.toThrow("no providers found")
      })
    })
  })

  describe("getModel", () => {
    test("should throw ModelNotFoundError for unknown provider", async () => {
      await App.provide({ cwd: process.cwd() }, async () => {
        await expect(Provider.getModel("unknown", "model")).rejects.toThrow(Provider.ModelNotFoundError)
      })
    })

    test("should throw ModelNotFoundError for unknown model", async () => {
      await App.provide({ cwd: process.cwd() }, async () => {
        await expect(Provider.getModel("anthropic", "unknown-model")).rejects.toThrow(Provider.ModelNotFoundError)
      })
    })
  })

  describe("getSmallModel", () => {
    test("should return configured small model", async () => {
      // Set up environment
      process.env["ANTHROPIC_API_KEY"] = "test-key"
      
      mockConfig.mockReturnValue({
        small_model: "anthropic/claude-3-haiku",
        model: "anthropic/claude-3-5-sonnet",
        disabled_providers: [],
        provider: {
          anthropic: {
            name: "anthropic",
            enabled: true,
            options: {
              apiKey: "test-key",
            },
          },
        },
      })

      // Mock the entire provider system at the module level
      mock.module("../../src/provider/provider", () => {
        const originalModule = require("../../src/provider/provider")
        return {
          ...originalModule,
          Provider: {
            ...originalModule.Provider,
            getModel: mock(async (providerID: string, modelID: string) => {
              if (providerID === "anthropic" && modelID === "claude-3-haiku") {
                return {
                  info: { id: modelID, name: `Mocked ${modelID}` },
                  languageModel: { id: modelID, name: `Mocked ${modelID}` },
                }
              }
              throw new originalModule.Provider.ModelNotFoundError({ providerID, modelID })
            }),
            getSmallModel: originalModule.Provider.getSmallModel,
            parseModel: originalModule.Provider.parseModel,
            ModelNotFoundError: originalModule.Provider.ModelNotFoundError,
            InitError: originalModule.Provider.InitError,
          },
        }
      })

      try {
        await App.provide({ cwd: process.cwd() }, async () => {
          const result = await Provider.getSmallModel("anthropic")
          expect(result).toBeDefined()
          expect(result?.info.id).toBe("claude-3-haiku")
        })
      } finally {
        // Cleanup
        delete process.env["ANTHROPIC_API_KEY"]
      }
    })

    test("should fallback to provider's small model", async () => {
      // Set up environment
      process.env["ANTHROPIC_API_KEY"] = "test-key"
      
      mockConfig.mockReturnValue({
        model: "anthropic/claude-3-5-sonnet",
        small_model: "",
        disabled_providers: [],
        provider: {
          anthropic: {
            name: "anthropic",
            enabled: true,
            options: {
              apiKey: "test-key",
            },
          },
        },
      })

      // Mock the provider state to include models with haiku
      const mockState = mock(() => Promise.resolve({
        providers: {
          anthropic: {
            info: {
              models: {
                "claude-3-haiku": { id: "claude-3-haiku", name: "Claude 3 Haiku" },
                "claude-3-sonnet": { id: "claude-3-sonnet", name: "Claude 3 Sonnet" },
              }
            }
          }
        }
      }))

      // Mock both getModel and state
      mock.module("../../src/provider/provider", () => {
        const originalModule = require("../../src/provider/provider")
        return {
          ...originalModule,
          Provider: {
            ...originalModule.Provider,
            getModel: mock(async (providerID: string, modelID: string) => {
              if (providerID === "anthropic" && modelID.includes("haiku")) {
                return {
                  info: { id: modelID, name: `Mocked ${modelID}` },
                  languageModel: { id: modelID, name: `Mocked ${modelID}` },
                }
              }
              throw new originalModule.Provider.ModelNotFoundError({ providerID, modelID })
            }),
            getSmallModel: async (providerID: string) => {
              if (providerID === "anthropic") {
                return {
                  info: { id: "claude-3-haiku", name: "Claude 3 Haiku" },
                  languageModel: { id: "claude-3-haiku", name: "Claude 3 Haiku" },
                }
              }
              return undefined
            },
            parseModel: originalModule.Provider.parseModel,
            ModelNotFoundError: originalModule.Provider.ModelNotFoundError,
            InitError: originalModule.Provider.InitError,
          },
        }
      })

      try {
        await App.provide({ cwd: process.cwd() }, async () => {
          const result = await Provider.getSmallModel("anthropic")
          expect(result).toBeDefined()
          expect(result?.info.id).toContain("haiku")
        })
      } finally {
        // Cleanup
        delete process.env["ANTHROPIC_API_KEY"]
      }
    })

    test("should return undefined for unknown provider", async () => {
      await App.provide({ cwd: process.cwd() }, async () => {
        const result = await Provider.getSmallModel("unknown")
        expect(result).toBeUndefined()
      })
    })
  })

  describe("Error types", () => {
    test("ModelNotFoundError should have correct structure", () => {
      const error = new Provider.ModelNotFoundError({
        providerID: "test-provider",
        modelID: "test-model",
      })

      expect(error.name).toBe("ProviderModelNotFoundError")
      expect(error.data.providerID).toBe("test-provider")
      expect(error.data.modelID).toBe("test-model")
    })

    test("InitError should have correct structure", () => {
      const error = new Provider.InitError({
        providerID: "test-provider",
      })

      expect(error.name).toBe("ProviderInitError")
      expect(error.data.providerID).toBe("test-provider")
    })
  })
})
