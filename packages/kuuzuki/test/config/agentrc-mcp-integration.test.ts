import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { parseAgentrc, mergeAgentrcMcpWithConfig, translateAgentrcMcpToConfig } from "../../src/config/agentrc"
import type { AgentrcConfig } from "../../src/config/agentrc"
import path from "path"
import fs from "fs/promises"
import os from "os"

describe("AgentRC MCP Integration", () => {
  let tempDir: string
  let agentrcPath: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kuuzuki-agentrc-test-"))
    agentrcPath = path.join(tempDir, ".agentrc")
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test("should translate .agentrc MCP stdio config to kuuzuki format", () => {
    const agentrcMcp: AgentrcConfig["mcp"] = {
      servers: {
        "test-server": {
          transport: "stdio",
          command: ["node", "server.js"],
          env: { NODE_ENV: "development" },
          enabled: true,
          notes: "Test MCP server"
        }
      }
    }

    const translated = translateAgentrcMcpToConfig(agentrcMcp)

    expect(translated).toEqual({
      "test-server": {
        type: "local",
        command: ["node", "server.js"],
        environment: { NODE_ENV: "development" },
        enabled: true
      }
    })
  })

  test("should translate .agentrc MCP http config to kuuzuki format", () => {
    const agentrcMcp: AgentrcConfig["mcp"] = {
      servers: {
        "remote-server": {
          transport: "http",
          url: "https://api.example.com/mcp",
          headers: { "Authorization": "Bearer token" },
          enabled: false,
          notes: "Remote MCP server"
        }
      }
    }

    const translated = translateAgentrcMcpToConfig(agentrcMcp)

    expect(translated).toEqual({
      "remote-server": {
        type: "remote",
        url: "https://api.example.com/mcp",
        headers: { "Authorization": "Bearer token" },
        enabled: false
      }
    })
  })

  test("should merge .agentrc MCP config with existing kuuzuki config", () => {
    const agentrcMcp: AgentrcConfig["mcp"] = {
      servers: {
        "agentrc-server": {
          transport: "stdio",
          command: ["bun", "run", "mcp-server.ts"],
          enabled: true
        },
        "shared-server": {
          transport: "stdio",
          command: ["from-agentrc"],
          enabled: true
        }
      }
    }

    const existingMcp = {
      "kuuzuki-server": {
        type: "local",
        command: ["existing", "server"],
        enabled: true
      },
      "shared-server": {
        type: "local",
        command: ["from-kuuzuki"],
        enabled: false
      }
    }

    const merged = mergeAgentrcMcpWithConfig(agentrcMcp, existingMcp)

    expect(merged).toEqual({
      "agentrc-server": {
        type: "local",
        command: ["bun", "run", "mcp-server.ts"],
        environment: {},
        enabled: true
      },
      "kuuzuki-server": {
        type: "local",
        command: ["existing", "server"],
        enabled: true
      },
      // kuuzuki.json takes precedence over .agentrc
      "shared-server": {
        type: "local",
        command: ["from-kuuzuki"],
        enabled: false
      }
    })
  })

  test("should handle empty .agentrc MCP config", () => {
    const translated = translateAgentrcMcpToConfig(undefined)
    expect(translated).toEqual({})

    const merged = mergeAgentrcMcpWithConfig(undefined, { "existing": { type: "local", command: ["test"] } })
    expect(merged).toEqual({ "existing": { type: "local", command: ["test"] } })
  })

  test("should parse complete .agentrc with MCP servers", async () => {
    const agentrcContent = {
      project: {
        name: "test-project",
        type: "typescript-monorepo"
      },
      mcp: {
        servers: {
          "kb-mcp": {
            transport: "stdio",
            command: ["kb", "serve", "--local"],
            env: { DEBUG: "1" },
            enabled: true,
            notes: "Knowledge base server"
          },
          "weather": {
            transport: "http",
            url: "https://weather.example.com/mcp",
            headers: { "API-Key": "secret" },
            enabled: true,
            notes: "Weather information server"
          }
        },
        preferredServers: ["kb-mcp"],
        disabledServers: ["weather"]
      }
    }

    await fs.writeFile(agentrcPath, JSON.stringify(agentrcContent, null, 2))
    const content = await fs.readFile(agentrcPath, "utf-8")
    const parsed = parseAgentrc(content)

    expect(parsed.project?.name).toBe("test-project")
    expect(parsed.mcp?.servers).toBeDefined()
    expect(Object.keys(parsed.mcp!.servers!)).toEqual(["kb-mcp", "weather"])

    const translated = translateAgentrcMcpToConfig(parsed.mcp)
    expect(translated["kb-mcp"]).toEqual({
      type: "local",
      command: ["kb", "serve", "--local"],
      environment: { DEBUG: "1" },
      enabled: true
    })
    expect(translated["weather"]).toEqual({
      type: "remote",
      url: "https://weather.example.com/mcp",
      headers: { "API-Key": "secret" },
      enabled: true
    })
  })

  test("should handle malformed .agentrc gracefully", () => {
    expect(() => parseAgentrc("invalid json")).toThrow("Invalid JSON in .agentrc")
    expect(() => parseAgentrc('{"mcp": {"servers": "not-an-object"}}')).toThrow()
  })

  test("should default enabled to true when not specified", () => {
    // Test with a raw object that doesn't specify enabled
    const rawAgentrcConfig = {
      project: { name: "test" },
      mcp: {
        servers: {
          "default-enabled": {
            transport: "stdio" as const,
            command: ["test"]
          }
        }
      }
    }

    // Parse it through the schema to get defaults applied
    const parsed = parseAgentrc(JSON.stringify(rawAgentrcConfig))
    const translated = translateAgentrcMcpToConfig(parsed.mcp)
    expect(translated["default-enabled"].enabled).toBe(true)
  })
})