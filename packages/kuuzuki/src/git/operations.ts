import { $ } from "bun"
import type { AgentrcConfig } from "../config/agentrc.js"
import { parseAgentrc } from "../config/agentrc.js"
import {
  GitPermissionManager,
  type GitOperationContext,
  type PermissionMode,
  type GitOperation,
} from "./permissions.js"
import { GitPromptSystem } from "./prompts.js"
import { GitContextProvider } from "./context.js"
import { Log } from "../util/log.js"

/**
 * Result of a Git operation
 */
export interface GitOperationResult {
  success: boolean
  message?: string
  output?: string
  error?: string
}

/**
 * Safe Git operations that respect permission system
 */
export class SafeGitOperations {
  private permissionManager: GitPermissionManager
  private promptSystem: GitPromptSystem
  private contextProvider: GitContextProvider
  private log = Log.create({ service: "SafeGitOperations" })

  constructor(config: AgentrcConfig) {
    this.permissionManager = new GitPermissionManager(config)
    this.promptSystem = new GitPromptSystem()
    this.contextProvider = new GitContextProvider()
  }

  /**
   * Safely commit changes with permission checks
   */
  async commit(
    message: string,
    files?: string[],
    options: { addAll?: boolean; amend?: boolean } = {},
  ): Promise<GitOperationResult> {
    try {
      // Check if we're in a Git repository
      const isRepo = await this.contextProvider.isGitRepository()
      if (!isRepo) {
        return {
          success: false,
          error: "Not in a Git repository",
        }
      }

      // Get current status
      const status = await this.contextProvider.getStatus()
      if (!status) {
        return {
          success: false,
          error: "Failed to get Git status",
        }
      }

      // Validate branch permissions
      if (!this.permissionManager.validateBranch(status.branch)) {
        return {
          success: false,
          error: `Commits not allowed on branch: ${status.branch}`,
        }
      }

      // Determine files to commit
      let filesToCommit: string[] = []
      if (options.addAll) {
        filesToCommit = [...status.unstaged, ...status.untracked]
      } else if (files) {
        filesToCommit = files
      } else {
        filesToCommit = status.staged
      }

      // Validate commit size
      if (!this.permissionManager.validateCommitSize(filesToCommit.length)) {
        return {
          success: false,
          error: `Too many files to commit (${filesToCommit.length}). Maximum allowed: ${this.permissionManager.getMaxCommitSize()}`,
        }
      }

      // Create operation context
      const context: GitOperationContext = {
        operation: "commit",
        files: filesToCommit,
        message,
        branch: status.branch,
      }

      // Check permissions
      const permission = await this.permissionManager.checkPermission(context)

      if (!permission.allowed) {
        if (permission.reason === "User confirmation required") {
          // Prompt user for permission
          const promptResult = await this.promptSystem.promptForPermission(context)

          if (!promptResult.allowed) {
            return {
              success: false,
              message: "Operation cancelled by user",
            }
          }

          // Handle permission scope
          if (promptResult.scope === "session") {
            this.permissionManager.grantSessionPermission("commit")
          } else if (promptResult.scope === "project" && promptResult.updateConfig) {
            await this.updateAgentrcConfig("commit", "project")
          }
        } else {
          return {
            success: false,
            error: permission.reason,
          }
        }
      }

      // Execute the commit
      return await this.executeCommit(message, filesToCommit, options)
    } catch (error) {
      this.log.error("Failed to commit", { error: String(error) })
      return {
        success: false,
        error: `Commit failed: ${String(error)}`,
      }
    }
  }

  /**
   * Safely push changes with permission checks
   */
  async push(
    remote?: string,
    branch?: string,
    options: { force?: boolean; setUpstream?: boolean } = {},
  ): Promise<GitOperationResult> {
    try {
      const status = await this.contextProvider.getStatus()
      if (!status) {
        return {
          success: false,
          error: "Failed to get Git status",
        }
      }

      const targetBranch = branch || status.branch
      const targetRemote = remote || "origin"

      const context: GitOperationContext = {
        operation: "push",
        branch: targetBranch,
        target: `${targetRemote}/${targetBranch}`,
      }

      const permission = await this.permissionManager.checkPermission(context)

      if (!permission.allowed) {
        if (permission.reason === "User confirmation required") {
          const promptResult = await this.promptSystem.promptForPermission(context)

          if (!promptResult.allowed) {
            return {
              success: false,
              message: "Push cancelled by user",
            }
          }

          if (promptResult.scope === "session") {
            this.permissionManager.grantSessionPermission("push")
          } else if (promptResult.scope === "project" && promptResult.updateConfig) {
            await this.updateAgentrcConfig("push", "project")
          }
        } else {
          return {
            success: false,
            error: permission.reason,
          }
        }
      }

      // Warn about force push
      if (options.force) {
        const confirmed = await this.promptSystem.confirmDangerousOperation(
          "Force Push",
          `Force pushing to ${targetRemote}/${targetBranch}`,
          ["May overwrite remote history", "Could cause data loss for other contributors", "Cannot be easily undone"],
        )

        if (!confirmed) {
          return {
            success: false,
            message: "Force push cancelled by user",
          }
        }
      }

      return await this.executePush(targetRemote, targetBranch, options)
    } catch (error) {
      this.log.error("Failed to push", { error: String(error) })
      return {
        success: false,
        error: `Push failed: ${String(error)}`,
      }
    }
  }

  /**
   * Execute the actual commit operation
   */
  private async executeCommit(
    message: string,
    files: string[],
    options: { addAll?: boolean; amend?: boolean },
  ): Promise<GitOperationResult> {
    try {
      // Add files if needed
      if (options.addAll) {
        await $`git add .`.quiet()
      } else if (files.length > 0) {
        await $`git add ${files.join(" ")}`.quiet()
      }

      // Commit
      const commitArgs = ["git", "commit", "-m", message]
      if (options.amend) {
        commitArgs.push("--amend")
      }

      const result = await $`${commitArgs}`.quiet()

      return {
        success: true,
        message: "Commit successful",
        output: result.stdout.toString(),
      }
    } catch (error) {
      return {
        success: false,
        error: `Commit execution failed: ${String(error)}`,
      }
    }
  }

  /**
   * Execute the actual push operation
   */
  private async executePush(
    remote: string,
    branch: string,
    options: { force?: boolean; setUpstream?: boolean },
  ): Promise<GitOperationResult> {
    try {
      const pushArgs = ["git", "push"]

      if (options.setUpstream) {
        pushArgs.push("-u")
      }

      if (options.force) {
        pushArgs.push("--force")
      }

      pushArgs.push(remote, branch)

      const result = await $`${pushArgs}`.quiet()

      return {
        success: true,
        message: "Push successful",
        output: result.stdout.toString(),
      }
    } catch (error) {
      return {
        success: false,
        error: `Push execution failed: ${String(error)}`,
      }
    }
  }

  /**
   * Get permission manager instance
   */
  getPermissionManager(): GitPermissionManager {
    return this.permissionManager
  }

  /**
   * Get context provider instance
   */
  getContextProvider(): GitContextProvider {
    return this.contextProvider
  }

  /**
   * Update .agentrc configuration for project-wide permissions
   */
  private async updateAgentrcConfig(operation: GitOperation, mode: PermissionMode): Promise<void> {
    try {
      this.log.info(`Updating .agentrc for ${operation} permission: ${mode}`)

      // Load current .agentrc or create minimal default
      let config: AgentrcConfig
      try {
        const file = Bun.file(".agentrc")
        if (await file.exists()) {
          const content = await file.text()
          config = parseAgentrc(content)
        } else {
          // Create minimal config that only includes required fields
          config = {
            project: { name: "project" },
            git: {
              commitMode: "ask",
              pushMode: "never",
              configMode: "never",
              preserveAuthor: true,
              requireConfirmation: true,
              maxCommitSize: 100,
            },
            metadata: {
              version: "1.0.0",
              generator: "kuuzuki-init",
            },
          }
        }
      } catch (error) {
        this.log.warn("Failed to load .agentrc, creating minimal config", { error: String(error) })
        // Create minimal config that only includes required fields
        config = {
          project: { name: "project" },
          git: {
            commitMode: "ask",
            pushMode: "never",
            configMode: "never",
            preserveAuthor: true,
            requireConfirmation: true,
            maxCommitSize: 100,
          },
          metadata: {
            version: "1.0.0",
            generator: "kuuzuki-init",
          },
        }
      }

      // Ensure git config exists (defensive programming)
      if (!config.git) {
        config.git = {
          commitMode: "ask",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: true,
          maxCommitSize: 100,
        }
      }

      // Update the specific operation permission
      switch (operation) {
        case "commit":
          config.git.commitMode = mode
          break
        case "push":
          config.git.pushMode = mode
          break
        case "config":
          config.git.configMode = mode
          break
      }

      // Write back to file atomically
      const content = JSON.stringify(config, null, 2)
      await Bun.write(".agentrc", content)

      this.log.info(`Successfully updated .agentrc: ${operation} = ${mode}`)
    } catch (error) {
      this.log.error("Failed to update .agentrc", { error: String(error) })
      throw new Error(`Failed to update .agentrc: ${String(error)}`)
    }
  }
}

/**
 * Create a SafeGitOperations instance
 */
export function createSafeGitOperations(config: AgentrcConfig): SafeGitOperations {
  return new SafeGitOperations(config)
}
