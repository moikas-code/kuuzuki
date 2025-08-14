import { z } from "zod"

/**
 * .agentrc configuration schema
 *
 * This file defines the structure for .agentrc files that replace AGENTS.md
 * with a machine-readable JSON format for AI agent configuration.
 */

export const AgentrcSchema = z.object({
  /**
   * Project metadata and basic information
   */
  project: z
    .object({
      name: z.string().describe("Project name"),
      type: z.string().optional().describe("Project type (e.g., 'typescript-monorepo', 'react-app', 'node-api')"),
      description: z.string().optional().describe("Brief project description"),
      version: z.string().optional().describe("Project version"),
      structure: z
        .object({
          packages: z.array(z.string()).optional().describe("List of package/module names in monorepos"),
          mainEntry: z.string().optional().describe("Main entry point file"),
          srcDir: z.string().optional().describe("Primary source directory"),
          testDir: z.string().optional().describe("Test directory"),
          docsDir: z.string().optional().describe("Documentation directory"),
        })
        .optional()
        .describe("Project structure information"),
    })
    .describe("Project metadata"),

  /**
   * Build, test, and development commands
   */
  commands: z
    .object({
      build: z.string().optional().describe("Build command"),
      test: z.string().optional().describe("Run all tests"),
      testSingle: z.string().optional().describe("Run single test file (use {file} placeholder)"),
      testWatch: z.string().optional().describe("Run tests in watch mode"),
      lint: z.string().optional().describe("Lint code"),
      lintFix: z.string().optional().describe("Lint and fix code"),
      typecheck: z.string().optional().describe("Type checking"),
      format: z.string().optional().describe("Format code"),
      dev: z.string().optional().describe("Start development server"),
      start: z.string().optional().describe("Start production server"),
      install: z.string().optional().describe("Install dependencies"),
      clean: z.string().optional().describe("Clean build artifacts"),
      deploy: z.string().optional().describe("Deploy application"),
    })
    .optional()
    .describe("Project commands"),

  /**
   * Code style and formatting preferences
   */
  codeStyle: z
    .object({
      language: z.string().optional().describe("Primary programming language"),
      formatter: z.string().optional().describe("Code formatter (e.g., 'prettier', 'black', 'rustfmt')"),
      linter: z.string().optional().describe("Linter (e.g., 'eslint', 'ruff', 'clippy')"),
      importStyle: z.enum(["esm", "commonjs", "mixed"]).optional().describe("Import/export style"),
      quotesStyle: z.enum(["single", "double", "backtick"]).optional().describe("Quote style preference"),
      semicolons: z.boolean().optional().describe("Use semicolons"),
      trailingCommas: z.boolean().optional().describe("Use trailing commas"),
      indentation: z
        .object({
          type: z.enum(["spaces", "tabs"]).optional(),
          size: z.number().optional(),
        })
        .optional()
        .describe("Indentation preferences"),
    })
    .optional()
    .describe("Code style configuration"),

  /**
   * Naming conventions and patterns
   */
  conventions: z
    .object({
      fileNaming: z
        .enum(["camelCase", "PascalCase", "kebab-case", "snake_case"])
        .optional()
        .describe("File naming convention"),
      functionNaming: z
        .enum(["camelCase", "PascalCase", "kebab-case", "snake_case"])
        .optional()
        .describe("Function naming convention"),
      variableNaming: z
        .enum(["camelCase", "PascalCase", "kebab-case", "snake_case"])
        .optional()
        .describe("Variable naming convention"),
      componentNaming: z
        .enum(["camelCase", "PascalCase", "kebab-case", "snake_case"])
        .optional()
        .describe("Component naming convention"),
      constantNaming: z
        .enum(["UPPER_CASE", "camelCase", "PascalCase"])
        .optional()
        .describe("Constant naming convention"),
      testFiles: z.string().optional().describe("Test file pattern (e.g., '*.test.ts', '*.spec.js')"),
      configFiles: z.array(z.string()).optional().describe("Important config files to be aware of"),
    })
    .optional()
    .describe("Naming conventions"),

  /**
   * Tools and technologies used in the project
   */
  tools: z
    .object({
      packageManager: z.enum(["npm", "yarn", "pnpm", "bun"]).optional().describe("Package manager"),
      runtime: z.string().optional().describe("Runtime environment (e.g., 'node', 'bun', 'deno')"),
      bundler: z.string().optional().describe("Bundler (e.g., 'webpack', 'vite', 'rollup', 'bun')"),
      framework: z.string().optional().describe("Framework (e.g., 'react', 'vue', 'svelte', 'next.js')"),
      database: z.string().optional().describe("Database (e.g., 'postgresql', 'mysql', 'sqlite', 'mongodb')"),
      orm: z.string().optional().describe("ORM/Query builder (e.g., 'prisma', 'drizzle', 'typeorm')"),
      testing: z.string().optional().describe("Testing framework (e.g., 'jest', 'vitest', 'mocha')"),
      ci: z.string().optional().describe("CI/CD platform (e.g., 'github-actions', 'gitlab-ci', 'jenkins')"),
    })
    .optional()
    .describe("Tools and technologies"),

  /**
   * Important file paths and directories
   */
  paths: z
    .object({
      src: z.string().optional().describe("Source code directory"),
      tests: z.string().optional().describe("Test directory"),
      docs: z.string().optional().describe("Documentation directory"),
      config: z.string().optional().describe("Configuration directory"),
      build: z.string().optional().describe("Build output directory"),
      assets: z.string().optional().describe("Static assets directory"),
      scripts: z.string().optional().describe("Scripts directory"),
    })
    .optional()
    .describe("Important paths"),

  /**
   * Development rules and guidelines
   */
  rules: z.union([
    z.array(z.string()).describe("Simple array of rules"),
    z.object({
      critical: z.array(z.any()).optional(),
      preferred: z.array(z.any()).optional(),
      contextual: z.array(z.any()).optional(),
      deprecated: z.array(z.any()).optional(),
    }).catchall(z.any()).describe("Structured rules object")
  ]).optional().describe("Development rules and guidelines"),

  /**
   * Dependencies and integrations
   */
  dependencies: z
    .object({
      critical: z.array(z.string()).optional().describe("Critical dependencies that should not be changed"),
      preferred: z.array(z.string()).optional().describe("Preferred libraries for common tasks"),
      avoid: z.array(z.string()).optional().describe("Libraries or patterns to avoid"),
    })
    .optional()
    .describe("Dependency preferences"),

  /**
   * Environment and deployment configuration
   */
  environment: z
    .object({
      nodeVersion: z.string().optional().describe("Required Node.js version"),
      envFiles: z.array(z.string()).optional().describe("Environment files (.env, .env.local, etc.)"),
      requiredEnvVars: z.array(z.string()).optional().describe("Required environment variables"),
      deployment: z
        .object({
          platform: z.string().optional().describe("Deployment platform"),
          buildCommand: z.string().optional().describe("Build command for deployment"),
          outputDir: z.string().optional().describe("Build output directory"),
        })
        .optional()
        .describe("Deployment configuration"),
    })
    .optional()
    .describe("Environment configuration"),

  /**
   * MCP (Model Context Protocol) server configurations
   * Based on official MCP specification: https://modelcontextprotocol.io/
   * MCP servers are self-describing and provide their own tool definitions and capabilities
   */
  mcp: z
    .object({
      servers: z
        .record(
          z.string(),
          z.discriminatedUnion("transport", [
            z.object({
              transport: z.literal("stdio").describe("Standard input/output transport for local processes"),
              command: z.array(z.string()).describe("Command and arguments to run the MCP server"),
              args: z
                .array(z.string())
                .optional()
                .describe("Additional arguments (alternative to including in command)"),
              env: z.record(z.string(), z.string()).optional().describe("Environment variables for the server process"),
              enabled: z.boolean().optional().default(true).describe("Enable or disable this MCP server"),
              notes: z
                .string()
                .optional()
                .describe("Optional notes about this server's purpose (for documentation only)"),
            }),
            z.object({
              transport: z.literal("http").describe("HTTP transport for remote MCP servers"),
              url: z.string().describe("URL of the remote MCP server"),
              headers: z.record(z.string(), z.string()).optional().describe("HTTP headers for authentication"),
              enabled: z.boolean().optional().default(true).describe("Enable or disable this MCP server"),
              notes: z
                .string()
                .optional()
                .describe("Optional notes about this server's purpose (for documentation only)"),
            }),
          ]),
        )
        .optional()
        .describe("MCP server connection configurations"),
      preferredServers: z.array(z.string()).optional().describe("Preferred MCP servers for this project"),
      disabledServers: z.array(z.string()).optional().describe("MCP servers to disable for this project"),
    })
    .optional()
    .describe("MCP server configurations"),


  /**
   * AI agent specific settings and individual agent definitions
   */
  agent: z
    .object({
      preferredTools: z.array(z.string()).optional().describe("Preferred built-in tools for this project"),
      disabledTools: z.array(z.string()).optional().describe("Built-in tools to disable for this project"),
      maxFileSize: z.number().optional().describe("Maximum file size to read (in bytes)"),
      ignorePatterns: z.array(z.string()).optional().describe("File patterns to ignore"),
      contextFiles: z.array(z.string()).optional().describe("Important context files to always consider"),
      taskExecution: z.string().optional().describe("Task execution strategy"),
      securityLevel: z.string().optional().describe("Security level for operations"),
      privacyMode: z.boolean().optional().describe("Enable privacy mode"),
      contextPreservation: z.boolean().optional().describe("Enable context preservation"),
    })
    .catchall(
      z.object({
        description: z.string().describe("Agent description"),
        prompt: z.string().describe("Agent system prompt"),
        model: z.string().optional().describe("Specific model for this agent"),
        tools: z.record(z.boolean()).describe("Tool availability for this agent"),
        disable: z.boolean().optional().describe("Disable this agent"),
      })
    )
    .optional()
    .describe("AI agent configuration and individual agent definitions"),

  /**
   * Metadata about this configuration file
   */
  metadata: z
    .object({
      version: z.string().optional().describe("Configuration schema version"),
      created: z.string().optional().describe("Creation timestamp"),
      updated: z.string().optional().describe("Last update timestamp"),
      generator: z.string().optional().describe("Tool that generated this file"),
      author: z.string().optional().describe("Author or team"),
    })
    .optional()
    .describe("Configuration metadata"),
})

export type AgentrcConfig = z.infer<typeof AgentrcSchema>

/**
 * Default .agentrc configuration
 */
export const DEFAULT_AGENTRC: Partial<AgentrcConfig> = {
  metadata: {
    version: "1.0.0",
    generator: "kuuzuki-init",
  },
}

/**
 * Validates and parses a .agentrc configuration
 */
export function parseAgentrc(content: string): AgentrcConfig {
  try {
    const json = JSON.parse(content)
    return AgentrcSchema.parse(json)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in .agentrc: ${error.message}`)
    }
    throw error
  }
}

/**
 * Converts .agentrc config to a formatted system prompt section
 */
export function agentrcToPrompt(config: AgentrcConfig): string {
  const sections: string[] = []

  // Project information
  if (config.project) {
    sections.push(`# ${config.project.name || "Project"}`)
    if (config.project.description) {
      sections.push(config.project.description)
    }
    if (config.project.type) {
      sections.push(`**Type**: ${config.project.type}`)
    }
    sections.push("")
  }

  // Commands
  if (config.commands && Object.keys(config.commands).length > 0) {
    sections.push("## Commands")
    Object.entries(config.commands).forEach(([key, value]) => {
      if (value) {
        sections.push(`- **${key}**: \`${value}\``)
      }
    })
    sections.push("")
  }

  // Code style
  if (config.codeStyle) {
    sections.push("## Code Style")
    if (config.codeStyle.language) sections.push(`- Language: ${config.codeStyle.language}`)
    if (config.codeStyle.formatter) sections.push(`- Formatter: ${config.codeStyle.formatter}`)
    if (config.codeStyle.linter) sections.push(`- Linter: ${config.codeStyle.linter}`)
    if (config.codeStyle.importStyle) sections.push(`- Import style: ${config.codeStyle.importStyle}`)
    sections.push("")
  }

  // Tools
  if (config.tools && Object.keys(config.tools).length > 0) {
    sections.push("## Tools")
    Object.entries(config.tools).forEach(([key, value]) => {
      if (value) {
        sections.push(`- **${key}**: ${value}`)
      }
    })
    sections.push("")
  }

  // Rules
  if (config.rules) {
    if (Array.isArray(config.rules) && config.rules.length > 0) {
      sections.push("## Development Rules")
      config.rules.forEach((rule: string) => {
        sections.push(`- ${rule}`)
      })
      sections.push("")
    } else if (typeof config.rules === 'object') {
      sections.push("## Development Rules")
      sections.push("See structured rules configuration")
      sections.push("")
    }
  }

  // Paths
  if (config.paths && Object.keys(config.paths).length > 0) {
    sections.push("## Important Paths")
    Object.entries(config.paths).forEach(([key, value]) => {
      if (value) {
        sections.push(`- **${key}**: \`${value}\``)
      }
    })
    sections.push("")
  }

  // Dependencies
  if (config.dependencies) {
    if (
      config.dependencies.critical?.length ||
      config.dependencies.preferred?.length ||
      config.dependencies.avoid?.length
    ) {
      sections.push("## Dependencies")
      if (config.dependencies.critical?.length) {
        sections.push(`- **Critical**: ${config.dependencies.critical.join(", ")}`)
      }
      if (config.dependencies.preferred?.length) {
        sections.push(`- **Preferred**: ${config.dependencies.preferred.join(", ")}`)
      }
      if (config.dependencies.avoid?.length) {
        sections.push(`- **Avoid**: ${config.dependencies.avoid.join(", ")}`)
      }
      sections.push("")
    }
  }

  // MCP servers
  if (config.mcp) {
    if (config.mcp.servers && Object.keys(config.mcp.servers).length > 0) {
      sections.push("## MCP Servers")
      Object.entries(config.mcp.servers).forEach(([name, server]) => {
        sections.push(`- **${name}**: ${server.notes || `${server.transport} MCP server`}`)
        if (server.transport === "stdio" && server.command) {
          sections.push(`  - Command: ${server.command.join(" ")}`)
        }
        if (server.transport === "http" && server.url) {
          sections.push(`  - URL: ${server.url}`)
        }
        if (server.enabled === false) {
          sections.push(`  - Status: Disabled`)
        }
      })
      if (config.mcp.preferredServers?.length) {
        sections.push(`- **Preferred servers**: ${config.mcp.preferredServers.join(", ")}`)
      }
      if (config.mcp.disabledServers?.length) {
        sections.push(`- **Disabled servers**: ${config.mcp.disabledServers.join(", ")}`)
      }
      sections.push("")
    }
  }


  // Agent settings
  if (config.agent) {
    if (
      config.agent.preferredTools?.length ||
      config.agent.disabledTools?.length ||
      config.agent.ignorePatterns?.length
    ) {
      sections.push("## AI Agent Configuration")
      if (config.agent.preferredTools?.length) {
        sections.push(`- **Preferred built-in tools**: ${config.agent.preferredTools.join(", ")}`)
      }
      if (config.agent.disabledTools?.length) {
        sections.push(`- **Disabled built-in tools**: ${config.agent.disabledTools.join(", ")}`)
      }
      if (config.agent.ignorePatterns?.length) {
        sections.push(`- **Ignore patterns**: ${config.agent.ignorePatterns.join(", ")}`)
      }
      sections.push("")
    }
  }

  return sections.join("\n").trim()
}

/**
 * Merges multiple .agentrc configurations, with later configs taking precedence
 */
export function mergeAgentrcConfigs(...configs: Partial<AgentrcConfig>[]): AgentrcConfig {
  const merged: Partial<AgentrcConfig> = {}

  for (const config of configs) {
    if (!config) continue

    // Merge project info
    if (config.project) {
      merged.project = { ...merged.project, ...config.project }
    }

    // Merge commands
    if (config.commands) {
      merged.commands = { ...merged.commands, ...config.commands }
    }

    // Merge code style
    if (config.codeStyle) {
      merged.codeStyle = { ...merged.codeStyle, ...config.codeStyle }
    }

    // Merge conventions
    if (config.conventions) {
      merged.conventions = { ...merged.conventions, ...config.conventions }
    }

    // Merge tools
    if (config.tools) {
      merged.tools = { ...merged.tools, ...config.tools }
    }

    // Merge paths
    if (config.paths) {
      merged.paths = { ...merged.paths, ...config.paths }
    }

    // Merge rules (concatenate and deduplicate)
    if (config.rules) {
      if (Array.isArray(config.rules)) {
        const existingRules = Array.isArray(merged.rules) ? merged.rules : []
        const newRules = config.rules.filter((rule: string) => !existingRules.includes(rule))
        merged.rules = [...existingRules, ...newRules]
      } else {
        // If it's an object, just merge it
        merged.rules = config.rules
      }
    }

    // Merge dependencies
    if (config.dependencies) {
      merged.dependencies = {
        critical: [...(merged.dependencies?.critical || []), ...(config.dependencies.critical || [])],
        preferred: [...(merged.dependencies?.preferred || []), ...(config.dependencies.preferred || [])],
        avoid: [...(merged.dependencies?.avoid || []), ...(config.dependencies.avoid || [])],
      }
    }

    // Merge environment
    if (config.environment) {
      merged.environment = { ...merged.environment, ...config.environment }
    }

    // Merge MCP configuration
    if (config.mcp) {
      merged.mcp = {
        servers: { ...merged.mcp?.servers, ...config.mcp.servers },
        preferredServers: [...(merged.mcp?.preferredServers || []), ...(config.mcp.preferredServers || [])],
        disabledServers: [...(merged.mcp?.disabledServers || []), ...(config.mcp.disabledServers || [])],
      }
    }


    // Merge agent settings
    if (config.agent) {
      merged.agent = { ...merged.agent, ...config.agent }
    }
    // Merge metadata
    if (config.metadata) {
      merged.metadata = { ...merged.metadata, ...config.metadata }
    }
  }

  return AgentrcSchema.parse(merged)
}

/**
 * Translates .agentrc MCP server configuration to the format expected by the MCP interpreter
 */
export function translateAgentrcMcpToConfig(agentrcMcp: AgentrcConfig["mcp"]): Record<string, any> {
  if (!agentrcMcp?.servers) {
    return {}
  }

  const translatedServers: Record<string, any> = {}

  for (const [serverName, serverConfig] of Object.entries(agentrcMcp.servers)) {
    // Handle discriminated union types
    if (serverConfig.transport === "stdio") {
      translatedServers[serverName] = {
        type: "local",
        command: serverConfig.command,
        environment: serverConfig.env || {},
        enabled: serverConfig.enabled ?? true,
      }
    } else if (serverConfig.transport === "http") {
      translatedServers[serverName] = {
        type: "remote",
        url: serverConfig.url,
        headers: serverConfig.headers || {},
        enabled: serverConfig.enabled ?? true,
      }
    }
  }

  return translatedServers
}

/**
 * Merges .agentrc MCP configuration with existing kuuzuki.json MCP configuration
 * kuuzuki.json takes precedence over .agentrc for conflicting server names
 */
export function mergeAgentrcMcpWithConfig(
  agentrcMcp: AgentrcConfig["mcp"],
  existingMcp: Record<string, any> = {}
): Record<string, any> {
  const translatedAgentrcMcp = translateAgentrcMcpToConfig(agentrcMcp)
  
  // Merge with existing config, giving precedence to existing config
  return {
    ...translatedAgentrcMcp,
    ...existingMcp,
  }
}
