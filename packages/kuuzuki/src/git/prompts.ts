import * as prompts from "../util/tui-safe-prompt.js"
import { Log } from "../util/log.js"
import type { GitOperationContext, GitOperation } from "./permissions.js"

/**
 * User choice for permission scope
 */
export type PermissionScope = "once" | "session" | "project" | "deny"

/**
 * Result of user permission prompt
 */
export interface PromptResult {
  allowed: boolean
  scope: PermissionScope
  updateConfig?: boolean
}

/**
 * Interactive prompt system for Git permissions
 */
export class GitPromptSystem {
  private log = Log.create({ service: "GitPromptSystem" })

  /**
   * Prompt user for Git operation permission
   */
  async promptForPermission(context: GitOperationContext): Promise<PromptResult> {
    this.log.info(`Prompting for ${context.operation} permission`)

    // Show operation context
    await this.showOperationContext(context)

    // Get user choice
    const choice = await this.getPermissionChoice(context.operation)

    if (choice === "deny") {
      return { allowed: false, scope: "deny" }
    }

    return {
      allowed: true,
      scope: choice,
      updateConfig: choice === "project",
    }
  }

  /**
   * Show detailed context about the Git operation
   */
  private async showOperationContext(context: GitOperationContext): Promise<void> {
    prompts.log(`\n🔒 Git ${context.operation.toUpperCase()} Permission Required\n`)

    switch (context.operation) {
      case "commit":
        await this.showCommitContext(context)
        break
      case "push":
        await this.showPushContext(context)
        break
      case "config":
        await this.showConfigContext(context)
        break
    }
  }

  /**
   * Show commit operation context
   */
  private async showCommitContext(context: GitOperationContext): Promise<void> {
    if (context.message) {
      prompts.log(`📝 Commit message: "${context.message}"`)
    }

    if (context.branch) {
      prompts.log(`🌿 Branch: ${context.branch}`)
    }

    if (context.files && context.files.length > 0) {
      prompts.log(`📁 Files to commit (${context.files.length}):`)

      // Show first 10 files, then summarize if more
      const displayFiles = context.files.slice(0, 10)
      for (const file of displayFiles) {
        prompts.log(`   • ${file}`)
      }

      if (context.files.length > 10) {
        prompts.log(`   ... and ${context.files.length - 10} more files`)
      }
    }

    // Offer to show diff
    const showDiff = await prompts.confirm({
      message: "Would you like to see the diff before deciding?",
      initialValue: false,
    })

    if (showDiff) {
      await this.showDiff()
    }
  }

  /**
   * Show push operation context
   */
  private async showPushContext(context: GitOperationContext): Promise<void> {
    if (context.branch) {
      prompts.log(`🌿 Pushing branch: ${context.branch}`)
    }

    if (context.target) {
      prompts.log(`🎯 Target: ${context.target}`)
    }
  }

  /**
   * Show config operation context
   */
  private async showConfigContext(context: GitOperationContext): Promise<void> {
    if (context.config) {
      prompts.log(`⚙️  Setting: ${context.config.key} = "${context.config.value}"`)
    }
  }

  /**
   * Get user's permission choice
   */
  private async getPermissionChoice(operation: GitOperation): Promise<PermissionScope> {
    const choice = await prompts.select<PermissionScope>({
      message: `How would you like to handle ${operation} operations?`,
      options: [
        {
          value: "once",
          label: "Yes, allow once",
          hint: "Perform this operation only",
        },
        {
          value: "session",
          label: "Yes, allow for this session",
          hint: "Allow until kuuzuki is restarted",
        },
        {
          value: "project",
          label: "Yes, always allow for this project",
          hint: "Update .agentrc to always allow",
        },
        {
          value: "deny",
          label: "No, don't allow",
          hint: "Cancel this operation",
        },
      ],
    })

    return choice as PermissionScope
  }

  /**
   * Show git diff (placeholder - would integrate with actual git commands)
   */
  private async showDiff(): Promise<void> {
    prompts.log("\n📋 Git Diff:")
    prompts.log("(Diff would be shown here - integration with git diff command needed)")
    prompts.log("")
  }

  /**
   * Prompt for branch selection when multiple branches are available
   */
  async promptForBranch(branches: string[], currentBranch: string): Promise<string | null> {
    if (branches.length === 0) {
      return null
    }

    if (branches.length === 1) {
      return branches[0]
    }

    const choice = await prompts.select<string>({
      message: "Select target branch:",
      options: branches.map((branch) => ({
        value: branch,
        label: branch,
        hint: branch === currentBranch ? "(current)" : "",
      })),
    })

    return choice as string
  }

  /**
   * Prompt for commit message if not provided
   */
  async promptForCommitMessage(defaultMessage?: string): Promise<string | null> {
    const message = await prompts.text({
      message: "Enter commit message:",
      placeholder: defaultMessage || "Update files",
      defaultValue: defaultMessage,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Commit message is required"
        }
        if (value.length > 72) {
          return "Commit message should be 72 characters or less"
        }
      },
    })

    return message as string | null
  }

  /**
   * Confirm dangerous operations
   */
  async confirmDangerousOperation(operation: string, details: string, consequences: string[]): Promise<boolean> {
    prompts.log(`\n⚠️  Dangerous Operation: ${operation}`)
    prompts.log(`📋 Details: ${details}`)

    if (consequences.length > 0) {
      prompts.log("\n🚨 Potential consequences:")
      for (const consequence of consequences) {
        prompts.log(`   • ${consequence}`)
      }
    }

    const confirmed = await prompts.confirm({
      message: "Are you sure you want to proceed?",
      initialValue: false,
    })

    return confirmed as boolean
  }

  /**
   * Show permission summary
   */
  async showPermissionSummary(permissions: Record<GitOperation, string>): Promise<void> {
    prompts.log("\n🔐 Current Git Permissions:")
    prompts.log(`   Commits: ${permissions.commit || "ask"}`)
    prompts.log(`   Pushes:  ${permissions.push || "never"}`)
    prompts.log(`   Config:  ${permissions.config || "never"}`)
    prompts.log("")
  }
}

/**
 * Create a GitPromptSystem instance
 */
export function createGitPromptSystem(): GitPromptSystem {
  return new GitPromptSystem()
}
