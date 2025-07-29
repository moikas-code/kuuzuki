import { z } from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./bash.txt"
import { App } from "../app/app"
import { createGitSafetySystem } from "../git/index.js"
import { parseAgentrc, DEFAULT_AGENTRC } from "../config/agentrc.js"

const MAX_OUTPUT_LENGTH = 30000
const DEFAULT_TIMEOUT = 1 * 60 * 1000
const MAX_TIMEOUT = 10 * 60 * 1000

export const BashTool = Tool.define("bash", {
  description: DESCRIPTION,
  parameters: z.object({
    command: z.string().describe("The command to execute"),
    timeout: z.number().min(0).max(MAX_TIMEOUT).describe("Optional timeout in milliseconds").optional(),
    description: z
      .string()
      .describe(
        "Clear, concise description of what this command does in 5-10 words. Examples:\nInput: ls\nOutput: Lists files in current directory\n\nInput: git status\nOutput: Shows working tree status\n\nInput: npm install\nOutput: Installs package dependencies\n\nInput: mkdir foo\nOutput: Creates directory 'foo'",
      ),
  }),
  async execute(params, ctx) {
    const timeout = Math.min(params.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT)

    // Check for Git commands that require permission
    await checkGitPermissions(params.command)

    const process = Bun.spawn({
      cmd: ["bash", "-c", params.command],
      cwd: App.info().path.cwd,
      maxBuffer: MAX_OUTPUT_LENGTH,
      signal: ctx.abort,
      timeout: timeout,
      stdout: "pipe",
      stderr: "pipe",
    })
    await process.exited
    const stdout = await new Response(process.stdout).text()
    const stderr = await new Response(process.stderr).text()

    return {
      title: params.command,
      metadata: {
        stderr,
        stdout,
        exit: process.exitCode,
        description: params.description,
      },
      output: [`<stdout>`, stdout ?? "", `</stdout>`, `<stderr>`, stderr ?? "", `</stderr>`].join("\n"),
    }
  },
})

/**
 * Check if a command contains Git operations that require permission
 */
async function checkGitPermissions(command: string): Promise<void> {
  // Git command patterns that require permission
  const gitCommitPattern = /git\s+commit/i
  const gitPushPattern = /git\s+push/i
  const gitConfigUserPattern = /git\s+config\s+.*user\./i

  // Check if command contains restricted Git operations
  if (gitCommitPattern.test(command) || gitPushPattern.test(command) || gitConfigUserPattern.test(command)) {
    try {
      // Load .agentrc configuration
      let config
      try {
        const file = Bun.file(".agentrc")
        if (await file.exists()) {
          const content = await file.text()
          config = parseAgentrc(content)
        } else {
          config = DEFAULT_AGENTRC
        }
      } catch {
        config = DEFAULT_AGENTRC
      }

      // Create Git safety system
      const gitSafety = createGitSafetySystem({
        project: { name: "bash-tool" },
        ...config,
      } as any)

      // Determine operation type
      let operation: "commit" | "push" | "config"
      if (gitCommitPattern.test(command)) {
        operation = "commit"
      } else if (gitPushPattern.test(command)) {
        operation = "push"
      } else {
        operation = "config"
      }

      // Check permissions
      const permission = await gitSafety.permissionManager.checkPermission({
        operation,
        files: [],
        message: `Command: ${command}`,
      })

      if (!permission.allowed) {
        if (permission.reason === "User confirmation required") {
          // Prompt user for permission
          const promptResult = await gitSafety.promptSystem.promptForPermission({
            operation,
            files: [],
            message: `Command: ${command}`,
          })

          if (!promptResult.allowed) {
            throw new Error(
              `Git ${operation} operation cancelled by user. Use 'kuuzuki git allow ${operation}s' to enable.`,
            )
          }

          // Handle permission scope
          if (promptResult.scope === "session") {
            gitSafety.permissionManager.grantSessionPermission(operation)
          } else if (promptResult.scope === "project" && promptResult.updateConfig) {
            // Update .agentrc for project-wide permission
            const newConfig = { ...config }
            if (!newConfig.git) {
              newConfig.git = {
                commitMode: "ask",
                pushMode: "never",
                configMode: "never",
                preserveAuthor: true,
                requireConfirmation: true,
                maxCommitSize: 100,
              }
            }

            switch (operation) {
              case "commit":
                newConfig.git.commitMode = "project"
                break
              case "push":
                newConfig.git.pushMode = "project"
                break
              case "config":
                newConfig.git.configMode = "project"
                break
            }

            const content = JSON.stringify(newConfig, null, 2)
            await Bun.write(".agentrc", content)
          }
        } else {
          throw new Error(
            `Git ${operation} operation denied: ${permission.reason}. Use 'kuuzuki git allow ${operation}s' to enable.`,
          )
        }
      }
    } catch (error) {
      // Re-throw permission errors
      if (error instanceof Error && (error.message.includes("cancelled") || error.message.includes("denied"))) {
        throw error
      }
      // Log other errors but don't block execution
      console.warn(`Warning: Git permission check failed: ${error}`)
    }
  }
}
