import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Config } from "../../src/config/config"
import { App } from "../../src/app/app"
import path from "path"
import fs from "fs/promises"
import os from "os"

describe("Config Integration with .agentrc", () => {
  let tempDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kuuzuki-config-test-"))
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test("should load and translate MCP servers from .agentrc", async () => {
    // Create a test .agentrc file
    const agentrcContent = {
      project: {
        name: "test-project",
        type: "typescript"
      },
      mcp: {
        servers: {
          "test-stdio": {
            transport: "stdio",
            command: ["echo", "test"],
            env: { NODE_ENV: "test" },
            enabled: true,
            notes: "Test server"
          },
          "test-http": {
            transport: "http",
            url: "https://api.example.com/mcp",
            headers: { "Authorization": "Bearer token" },
            enabled: false,
            notes: "HTTP server"
          }
        }
      }
    }

    await fs.writeFile(path.join(tempDir, ".agentrc"), JSON.stringify(agentrcContent, null, 2))

    // Initialize the app with the temp directory and load config
    const config = await App.provide({ cwd: tempDir }, async (_app) => {
      return await Config.get()
    })

    // Verify MCP servers were loaded and translated correctly
    expect(config.mcp).toBeDefined()
    expect(config.mcp!["test-stdio"]).toMatchObject({
      type: "local",
      command: ["echo", "test"],
      environment: { NODE_ENV: "test" },
      enabled: true
    })
    expect(config.mcp!["test-http"]).toMatchObject({
      type: "remote",
      url: "https://api.example.com/mcp",
      headers: { "Authorization": "Bearer token" },
      enabled: false
    })
  })

  test("should merge .agentrc MCP with kuuzuki.json MCP config", async () => {
    // Create .agentrc with MCP servers
    const agentrcContent = {
      project: { name: "test" },
      mcp: {
        servers: {
          "agentrc-server": {
            transport: "stdio",
            command: ["from-agentrc"],
            enabled: true
          },
          "shared-server": {
            transport: "stdio",
            command: ["from-agentrc"],
            enabled: true
          }
        }
      }
    }

    // Create kuuzuki.json with MCP servers
    const kuuzukiConfig = {
      mcp: {
        "kuuzuki-server": {
          type: "local",
          command: ["from-kuuzuki"],
          enabled: true
        },
        "shared-server": {
          type: "local",
          command: ["from-kuuzuki"],
          enabled: false
        }
      }
    }

    await fs.writeFile(path.join(tempDir, ".agentrc"), JSON.stringify(agentrcContent, null, 2))
    await fs.writeFile(path.join(tempDir, "kuuzuki.json"), JSON.stringify(kuuzukiConfig, null, 2))

    // Initialize the app and load configuration
    const config = await App.provide({ cwd: tempDir }, async (_app) => {
      return await Config.get()
    })

    // Verify both configs were merged with kuuzuki.json taking precedence
    expect(config.mcp).toBeDefined()
    expect(config.mcp!["agentrc-server"]).toMatchObject({
      type: "local",
      command: ["from-agentrc"],
      environment: {},
      enabled: true
    })
    expect(config.mcp!["kuuzuki-server"]).toMatchObject({
      type: "local",
      command: ["from-kuuzuki"],
      enabled: true
    })
    // kuuzuki.json should take precedence for shared-server
    expect(config.mcp!["shared-server"]).toMatchObject({
      type: "local",
      command: ["from-kuuzuki"],
      enabled: false
    })
  })

  test("should handle missing .agentrc gracefully", async () => {
    // Create only kuuzuki.json
    const kuuzukiConfig = {
      mcp: {
        "kuuzuki-only": {
          type: "local",
          command: ["test"],
          enabled: true
        }
      }
    }

    await fs.writeFile(path.join(tempDir, "kuuzuki.json"), JSON.stringify(kuuzukiConfig, null, 2))

    // Initialize the app and load configuration
    const config = await App.provide({ cwd: tempDir }, async (_app) => {
      return await Config.get()
    })

    // Should still work with just kuuzuki.json
    expect(config.mcp).toBeDefined()
    expect(config.mcp!["kuuzuki-only"]).toMatchObject({
      type: "local",
      command: ["test"],
      enabled: true
    })
  })
})