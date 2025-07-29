import { describe, expect, test } from "bun:test"
import { Mode } from "../../src/session/mode"
import { App } from "../../src/app/app"
import { Config } from "../../src/config/config"

describe("Mode.list()", () => {
  // Mock configuration for testing
  const mockConfig = {
    model: "anthropic/claude-3-sonnet-20240229",
    mode: {
      custom: {
        model: "anthropic/claude-3-haiku-20240307",
        temperature: 0.7,
        prompt: "You are a helpful assistant",
        tools: {
          write: true,
          edit: true,
        },
      },
      disabled: {
        disable: true,
        model: "anthropic/claude-3-opus-20240229",
      },
    },
  }

  test("should return default modes when no custom configuration", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Mock Config.get to return minimal config
      const originalGet = Config.get
      Config.get = async () => ({ model: "anthropic/claude-3-sonnet-20240229" })

      try {
        const modes = await Mode.list()

        expect(Array.isArray(modes)).toBe(true)
        expect(modes.length).toBeGreaterThanOrEqual(3)

        // Check for default modes
        const modeNames = modes.map((m) => m.name)
        expect(modeNames).toContain("build")
        expect(modeNames).toContain("plan")
        expect(modeNames).toContain("chat")

        // Verify structure of returned modes
        for (const mode of modes) {
          expect(mode).toHaveProperty("name")
          expect(mode).toHaveProperty("tools")
          expect(typeof mode.name).toBe("string")
          expect(typeof mode.tools).toBe("object")
        }
      } finally {
        Config.get = originalGet
      }
    })
  })

  test("should include custom modes from configuration", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Mock Config.get to return config with custom modes
      const originalGet = Config.get
      Config.get = async () => mockConfig

      try {
        const modes = await Mode.list()

        expect(Array.isArray(modes)).toBe(true)

        // Check that custom mode is included
        const customMode = modes.find((m) => m.name === "custom")
        expect(customMode).toBeDefined()
        expect(customMode?.model).toEqual({
          modelID: "claude-3-haiku-20240307",
          providerID: "anthropic",
        })
        expect(customMode?.temperature).toBe(0.7)
        expect(customMode?.prompt).toBe("You are a helpful assistant")
        expect(customMode?.tools).toMatchObject({
          write: true,
          edit: true,
        })
      } finally {
        Config.get = originalGet
      }
    })
  })

  test("should exclude disabled modes", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Mock Config.get to return config with disabled mode
      const originalGet = Config.get
      Config.get = async () => mockConfig

      try {
        const modes = await Mode.list()

        // Check that disabled mode is not included
        const disabledMode = modes.find((m) => m.name === "disabled")
        expect(disabledMode).toBeUndefined()
      } finally {
        Config.get = originalGet
      }
    })
  })

  test("should handle empty configuration gracefully", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Mock Config.get to return empty config
      const originalGet = Config.get
      Config.get = async () => ({})

      try {
        const modes = await Mode.list()

        expect(Array.isArray(modes)).toBe(true)
        expect(modes.length).toBeGreaterThanOrEqual(3)

        // Should still have default modes
        const modeNames = modes.map((m) => m.name)
        expect(modeNames).toContain("build")
        expect(modeNames).toContain("plan")
        expect(modeNames).toContain("chat")
      } finally {
        Config.get = originalGet
      }
    })
  })

  test("should return modes with correct tool restrictions", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Mock Config.get to return minimal config
      const originalGet = Config.get
      Config.get = async () => ({ model: "anthropic/claude-3-sonnet-20240229" })

      try {
        const modes = await Mode.list()

        // Check plan mode has restricted tools
        const planMode = modes.find((m) => m.name === "plan")
        expect(planMode).toBeDefined()
        expect(planMode?.tools.write).toBe(false)
        expect(planMode?.tools.edit).toBe(false)
        expect(planMode?.tools.patch).toBe(false)

        // Check chat mode has restricted tools
        const chatMode = modes.find((m) => m.name === "chat")
        expect(chatMode).toBeDefined()
        expect(chatMode?.tools.write).toBe(false)
        expect(chatMode?.tools.edit).toBe(false)
        expect(chatMode?.tools.patch).toBe(false)
        expect(chatMode?.tools.bash).toBe(false)
        expect(chatMode?.tools.todowrite).toBe(false)

        // Check build mode has no tool restrictions by default
        const buildMode = modes.find((m) => m.name === "build")
        expect(buildMode).toBeDefined()
        expect(buildMode?.tools).toEqual({})
      } finally {
        Config.get = originalGet
      }
    })
  })

  test("should merge custom tool configurations with defaults", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      const configWithToolOverrides = {
        model: "anthropic/claude-3-sonnet-20240229",
        mode: {
          plan: {
            tools: {
              write: true, // Override default restriction
              custom_tool: true,
            },
          },
        },
      }

      // Mock Config.get to return config with tool overrides
      const originalGet = Config.get
      Config.get = async () => configWithToolOverrides

      try {
        const modes = await Mode.list()

        const planMode = modes.find((m) => m.name === "plan")
        expect(planMode).toBeDefined()

        // Should have merged tools (custom overrides + defaults)
        expect(planMode?.tools.write).toBe(false) // Default takes precedence
        expect(planMode?.tools.edit).toBe(false) // Default restriction
        expect(planMode?.tools.patch).toBe(false) // Default restriction
        expect(planMode?.tools.custom_tool).toBe(true) // Custom addition
      } finally {
        Config.get = originalGet
      }
    })
  })

  test("should handle model parsing correctly", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      const configWithModels = {
        model: "anthropic/claude-3-sonnet-20240229",
        mode: {
          custom: {
            model: "openai/gpt-4",
          },
        },
      }

      // Mock Config.get to return config with different models
      const originalGet = Config.get
      Config.get = async () => configWithModels

      try {
        const modes = await Mode.list()

        // Check default model is parsed correctly
        const buildMode = modes.find((m) => m.name === "build")
        expect(buildMode?.model).toEqual({
          modelID: "claude-3-sonnet-20240229",
          providerID: "anthropic",
        })

        // Check custom model is parsed correctly
        const customMode = modes.find((m) => m.name === "custom")
        expect(customMode?.model).toEqual({
          modelID: "gpt-4",
          providerID: "openai",
        })
      } finally {
        Config.get = originalGet
      }
    })
  })

  test("should return consistent results on multiple calls", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Mock Config.get to return stable config
      const originalGet = Config.get
      Config.get = async () => mockConfig

      try {
        const modes1 = await Mode.list()
        const modes2 = await Mode.list()

        expect(modes1).toEqual(modes2)
        expect(modes1.length).toBe(modes2.length)

        // Verify order is consistent
        for (let i = 0; i < modes1.length; i++) {
          expect(modes1[i].name).toBe(modes2[i].name)
        }
      } finally {
        Config.get = originalGet
      }
    })
  })
})
