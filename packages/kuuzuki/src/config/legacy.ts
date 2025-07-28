import { Filesystem } from "../util/filesystem"
import { Global } from "../global"
import { App } from "../app/app"
import { Config } from "./config"
import path from "path"
import os from "os"

/**
 * Utility functions for handling legacy AGENTS.md and CLAUDE.md files
 */

export namespace LegacyFiles {
  /**
   * Finds and reads all legacy configuration files
   */
  export async function findAll(): Promise<{
    agentsFiles: Array<{ path: string; content: string }>
    claudeFiles: Array<{ path: string; content: string }>
    cursorFiles: Array<{ path: string; content: string }>
  }> {
    const { cwd, root } = App.info().path
    const agentsFiles: Array<{ path: string; content: string }> = []
    const claudeFiles: Array<{ path: string; content: string }> = []
    const cursorFiles: Array<{ path: string; content: string }> = []

    // Find project-level AGENTS.md files
    const agentsMatches = await Filesystem.findUp("AGENTS.md", cwd, root)
    for (const filePath of agentsMatches) {
      try {
        const content = await Bun.file(filePath).text()
        if (content.trim()) {
          agentsFiles.push({ path: filePath, content })
        }
      } catch {
        // Skip files that can't be read
      }
    }

    // Find project-level CLAUDE.md files
    const claudeMatches = await Filesystem.findUp("CLAUDE.md", cwd, root)
    for (const filePath of claudeMatches) {
      try {
        const content = await Bun.file(filePath).text()
        if (content.trim()) {
          claudeFiles.push({ path: filePath, content })
        }
      } catch {
        // Skip files that can't be read
      }
    }

    // Check global locations
    try {
      const globalAgents = path.join(Global.Path.config, "AGENTS.md")
      const content = await Bun.file(globalAgents).text()
      if (content.trim()) {
        agentsFiles.push({ path: globalAgents, content })
      }
    } catch {
      // Global AGENTS.md doesn't exist or can't be read
    }

    try {
      const globalClaude = path.join(os.homedir(), ".claude", "CLAUDE.md")
      const content = await Bun.file(globalClaude).text()
      if (content.trim()) {
        claudeFiles.push({ path: globalClaude, content })
      }
    } catch {
      // Global CLAUDE.md doesn't exist or can't be read
    }

    // Find Cursor rules files
    const cursorRuleFiles = [
      ".cursorrules",
      ".cursor/rules/",
      ".github/copilot-instructions.md",
      ".vscode/cursor-rules.md",
    ]

    for (const fileName of cursorRuleFiles) {
      try {
        if (fileName.endsWith("/")) {
          // Directory - find all files in it
          const dirPath = path.join(cwd, fileName)
          try {
            const entries = await Bun.file(dirPath).text() // This will fail, but we can try readdir
          } catch {
            // Try reading as directory
            try {
              const fs = await import("fs/promises")
              const files = await fs.readdir(path.join(cwd, fileName))
              for (const file of files) {
                if (file.endsWith(".md") || file.endsWith(".txt") || !file.includes(".")) {
                  const filePath = path.join(cwd, fileName, file)
                  try {
                    const content = await Bun.file(filePath).text()
                    if (content.trim()) {
                      cursorFiles.push({ path: filePath, content })
                    }
                  } catch {
                    // Skip files that can't be read
                  }
                }
              }
            } catch {
              // Directory doesn't exist
            }
          }
        } else {
          // Single file
          const filePath = path.join(cwd, fileName)
          const content = await Bun.file(filePath).text()
          if (content.trim()) {
            cursorFiles.push({ path: filePath, content })
          }
        }
      } catch {
        // File doesn't exist or can't be read
      }
    }

    return { agentsFiles, claudeFiles, cursorFiles }
  }

  /**
   * Creates a context summary of legacy files for the initialization prompt
   */
  export async function createContextSummary(): Promise<string> {
    const { agentsFiles, claudeFiles, cursorFiles } = await findAll()
    const mcpConfig = await findMcpConfiguration()

    if (agentsFiles.length === 0 && claudeFiles.length === 0 && cursorFiles.length === 0 && !mcpConfig) {
      return ""
    }

    const sections: string[] = []

    sections.push("## Existing Configuration Files")
    sections.push("")
    sections.push("The following configuration files were found and should be integrated into the new .agentrc:")
    sections.push("")

    // AGENTS.md files
    if (agentsFiles.length > 0) {
      sections.push("### AGENTS.md Files")
      for (const file of agentsFiles) {
        sections.push(`**${file.path}:**`)
        sections.push("```markdown")
        sections.push(file.content)
        sections.push("```")
        sections.push("")
      }
    }

    // CLAUDE.md files
    if (claudeFiles.length > 0) {
      sections.push("### CLAUDE.md Files")
      for (const file of claudeFiles) {
        sections.push(`**${file.path}:**`)
        sections.push("```markdown")
        sections.push(file.content)
        sections.push("```")
        sections.push("")
      }
    }

    // Cursor rules files
    if (cursorFiles.length > 0) {
      sections.push("### Cursor Rules Files")
      for (const file of cursorFiles) {
        sections.push(`**${file.path}:**`)
        sections.push("```")
        sections.push(file.content)
        sections.push("```")
        sections.push("")
      }
    }

    // MCP configuration
    if (mcpConfig) {
      sections.push("### Existing MCP Configuration")
      sections.push("```json")
      sections.push(JSON.stringify(mcpConfig, null, 2))
      sections.push("```")
      sections.push("")
    }

    sections.push("**Integration Instructions:**")
    sections.push(
      "- Extract structured information (commands, tools, paths) from AGENTS.md into appropriate .agentrc fields",
    )
    sections.push("- Convert development rules and guidelines from AGENTS.md, CLAUDE.md, and Cursor rules into the rules array")
    sections.push("- Include Cursor rules and AI editor preferences from .cursorrules and .cursor/rules/ files")
    sections.push("- Include existing MCP server configurations in the mcp.servers section (connection details only)")
    sections.push(
      "- Note: MCP servers are self-describing and will provide their own tool definitions and capabilities",
    )
    sections.push("- Preserve project context and coding standards from all sources")
    sections.push("- Merge overlapping information intelligently, avoiding duplication")
    sections.push("")

    return sections.join("\n")
  }

  /**
   * Finds existing MCP configuration from kuuzuki config files
   */
  export async function findMcpConfiguration(): Promise<Record<string, any> | null> {
    try {
      const config = await Config.get()
      if (config.mcp && Object.keys(config.mcp).length > 0) {
        return config.mcp
      }
    } catch {
      // Config not available or no MCP configuration
    }
    return null
  }

  /**
   * Checks if any legacy files exist
   */
  export async function hasLegacyFiles(): Promise<boolean> {
    const { agentsFiles, claudeFiles, cursorFiles } = await findAll()
    return agentsFiles.length > 0 || claudeFiles.length > 0 || cursorFiles.length > 0
  }

  /**
   * Extracts common patterns from legacy files for better integration
   */
  export async function extractPatterns(): Promise<{
    commands: Record<string, string>
    rules: string[]
    tools: string[]
    projectInfo: { name?: string; description?: string; type?: string }
  }> {
    const { agentsFiles, claudeFiles, cursorFiles } = await findAll()
    const allContent = [...agentsFiles, ...claudeFiles, ...cursorFiles].map((f) => f.content).join("\n\n")

    const patterns = {
      commands: {} as Record<string, string>,
      rules: [] as string[],
      tools: [] as string[],
      projectInfo: {} as { name?: string; description?: string; type?: string },
    }

    // Extract common command patterns
    const commandPatterns = [
      /(?:build|Build):\s*`([^`]+)`/gi,
      /(?:test|Test):\s*`([^`]+)`/gi,
      /(?:lint|Lint):\s*`([^`]+)`/gi,
      /(?:dev|Dev|Development):\s*`([^`]+)`/gi,
      /(?:start|Start):\s*`([^`]+)`/gi,
    ]

    for (const pattern of commandPatterns) {
      const matches = allContent.matchAll(pattern)
      for (const match of matches) {
        const command = match[1]?.trim()
        if (command) {
          const key = match[0].toLowerCase().split(":")[0].trim()
          patterns.commands[key] = command
        }
      }
    }

    // Extract rules (lines starting with -, bullet points, or "Rule:" patterns)
    const rulePatterns = [
      /^[-*]\s+(.+)$/gm,
      /(?:Rule|Guideline|Standard):\s*(.+)$/gim,
      /(?:Always|Never|Prefer|Use|Avoid):\s*(.+)$/gim,
    ]

    for (const pattern of rulePatterns) {
      const matches = allContent.matchAll(pattern)
      for (const match of matches) {
        const rule = match[1]?.trim()
        if (rule && rule.length > 10 && !patterns.rules.includes(rule)) {
          patterns.rules.push(rule)
        }
      }
    }

    // Extract tool mentions
    const toolKeywords = [
      "typescript",
      "javascript",
      "react",
      "vue",
      "angular",
      "svelte",
      "node",
      "bun",
      "deno",
      "npm",
      "yarn",
      "pnpm",
      "webpack",
      "vite",
      "rollup",
      "parcel",
      "jest",
      "vitest",
      "mocha",
      "cypress",
      "eslint",
      "prettier",
      "biome",
      "prisma",
      "drizzle",
      "typeorm",
      "postgresql",
      "mysql",
      "sqlite",
      "mongodb",
    ]

    for (const tool of toolKeywords) {
      const regex = new RegExp(`\\b${tool}\\b`, "gi")
      if (regex.test(allContent) && !patterns.tools.includes(tool)) {
        patterns.tools.push(tool)
      }
    }

    // Extract project info from headers
    const headerMatch = allContent.match(/^#\s+(.+)$/m)
    if (headerMatch) {
      patterns.projectInfo.name = headerMatch[1].trim()
    }

    const descriptionMatch = allContent.match(/(?:description|about):\s*(.+)$/im)
    if (descriptionMatch) {
      patterns.projectInfo.description = descriptionMatch[1].trim()
    }

    return patterns
  }
}
